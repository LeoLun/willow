import { createHash } from "node:crypto";
import { copyFile, mkdir, open, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { extractFile, statFile } from "@electron/asar";
import type { AppUpdateState } from "@shared/api";
import { APP_UPDATE_EVENT } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { app, shell } from "electron";
import { getHotUpdateRuntimeContext } from "../update/hot-update-launcher";
import { getUpdateDirectory, readUpdateStore, writeUpdateStore } from "../update/update-store";
import { classifyUpdate, parseStableVersion } from "../update/version";
import { DbService } from "./db.service";
import { EventService } from "./event.service";

export { classifyUpdate, compareVersions, parseStableVersion } from "../update/version";

const LATEST_RELEASE_URL = "https://leolun.github.io/willow/latest.json";
const MAX_ASAR_BYTES = 250 * 1024 * 1024;
const NETWORK_TIMEOUT_MS = 30_000;
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;

interface ReleaseAsset {
  name: string;
  size: number;
  browser_download_url: string;
}

interface LatestRelease {
  tag_name: string;
  html_url: string;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

interface AvailableRelease {
  version: string;
  releaseUrl: string;
  asar: ReleaseAsset;
  checksum: ReleaseAsset;
}

export function getAsarDownloadPaths(versionDirectory: string): {
  finalPath: string;
  temporaryPath: string;
} {
  return {
    finalPath: join(versionDirectory, "app.asar"),
    // Keep partial downloads from Electron's transparent ASAR path handling.
    temporaryPath: join(versionDirectory, "app.asar.part"),
  };
}

export function validateAsar(asarPath: string, version: string): void {
  const manifest = JSON.parse(extractFile(asarPath, "package.json").toString("utf8")) as {
    version?: string;
  };
  if (manifest.version !== version) throw new Error("ASAR version mismatch");
  [
    ".vite/build/main.js",
    ".vite/build/preload.js",
    "assets/icons/trayTemplate.png",
    "assets/icons/trayTemplate@2x.png",
    "src/main/db/migrations/meta/_journal.json",
    "resources/skills",
  ].forEach((path) => statFile(asarPath, path));
}

@Injectable()
export class AppUpdateService {
  private state: AppUpdateState;
  private availableRelease?: AvailableRelease;
  private checkPromise?: Promise<AppUpdateState>;
  private downloadPromise?: Promise<AppUpdateState>;

  constructor(
    private readonly eventService: EventService,
    private readonly dbService: DbService,
  ) {
    const context = getHotUpdateRuntimeContext();
    const currentVersion = context?.currentVersion ?? app.getVersion();
    const store = readUpdateStore(app.getPath("userData"));
    this.state = store.staged
      ? {
          status: "ready",
          currentVersion,
          latestVersion: store.staged.version,
          progress: 100,
        }
      : { status: "upToDate", currentVersion };
  }

  getState(): AppUpdateState {
    return this.state;
  }

  getCurrentVersion(): string {
    return this.state.currentVersion;
  }

  checkForUpdate(): Promise<AppUpdateState> {
    if (this.state.status === "ready" || this.state.status === "downloading") {
      return Promise.resolve(this.state);
    }
    if (this.checkPromise) return this.checkPromise;
    this.checkPromise = this.performCheck().finally(() => {
      this.checkPromise = undefined;
    });
    return this.checkPromise;
  }

  downloadUpdate(): Promise<AppUpdateState> {
    if (this.downloadPromise) return this.downloadPromise;
    this.downloadPromise = this.performDownload().finally(() => {
      this.downloadPromise = undefined;
    });
    return this.downloadPromise;
  }

  async confirmUpdateBoot(): Promise<AppUpdateState> {
    const context = getHotUpdateRuntimeContext();
    if (!context?.pending) return this.state;
    this.dbService.init();
    const userDataPath = app.getPath("userData");
    const store = readUpdateStore(userDataPath);
    if (store.pending?.version !== context.currentVersion) return this.state;
    if (store.databaseBackupPath) await rm(store.databaseBackupPath, { force: true });
    writeUpdateStore(userDataPath, { active: store.pending });
    context.pending = false;
    return this.state;
  }

  async restartToUpdate(): Promise<void> {
    const userDataPath = app.getPath("userData");
    const store = readUpdateStore(userDataPath);
    if (!store.staged) throw new Error("No downloaded update is ready");
    this.dbService.prepareForUpdate();
    const databasePath = this.dbService.getDatabasePath();
    const backupPath = join(getUpdateDirectory(userDataPath), "willow.db.backup");
    try {
      await copyFile(databasePath, backupPath);
      store.databaseBackupPath = backupPath;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      store.databaseBackupPath = undefined;
    }
    store.pending = { ...store.staged, launchAttempted: false };
    delete store.staged;
    writeUpdateStore(userDataPath, store);
    app.relaunch();
    app.exit(0);
  }

  async openManualUpdate(): Promise<void> {
    if (this.state.status !== "manualAvailable") throw new Error("No manual update is available");
    await shell.openExternal(this.state.releaseUrl);
  }

  private async performCheck(): Promise<AppUpdateState> {
    if (!app.isPackaged || process.platform !== "darwin") return this.state;
    this.setState({
      status: "checking",
      currentVersion: this.state.currentVersion,
    });
    try {
      const response = await fetch(LATEST_RELEASE_URL, {
        headers: { Accept: "application/json" },
        redirect: "follow",
        signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`Release request failed: ${response.status}`);
      const release = (await response.json()) as LatestRelease;
      const kind =
        release.draft || release.prerelease
          ? "none"
          : classifyUpdate(this.state.currentVersion, release.tag_name);
      const latest = parseStableVersion(release.tag_name);
      if (!latest || kind === "none") {
        return this.setState({
          status: "upToDate",
          currentVersion: this.state.currentVersion,
        });
      }
      if (kind === "manual") {
        return this.setState({
          status: "manualAvailable",
          currentVersion: this.state.currentVersion,
          latestVersion: latest.normalized,
          releaseUrl: release.html_url,
        });
      }
      const asarName = `app-v${latest.normalized}.asar`;
      const checksumName = `${asarName}.sha256`;
      const asar = release.assets.find((asset) => asset.name === asarName);
      const checksum = release.assets.find((asset) => asset.name === checksumName);
      if (!asar || !checksum || asar.size <= 0 || asar.size > MAX_ASAR_BYTES) {
        throw new Error("Release assets are incomplete");
      }
      this.availableRelease = {
        version: latest.normalized,
        releaseUrl: release.html_url,
        asar,
        checksum,
      };
      return this.setState({
        status: "hotAvailable",
        currentVersion: this.state.currentVersion,
        latestVersion: latest.normalized,
        progress: 0,
      });
    } catch {
      return this.setState({
        status: "checkFailed",
        currentVersion: this.state.currentVersion,
      });
    }
  }

  private async performDownload(): Promise<AppUpdateState> {
    const release = this.availableRelease;
    if (!release) throw new Error("No hot update is available");
    const userDataPath = app.getPath("userData");
    const versionDirectory = join(getUpdateDirectory(userDataPath), `v${release.version}`);
    const { finalPath, temporaryPath } = getAsarDownloadPaths(versionDirectory);
    await mkdir(versionDirectory, { recursive: true });
    await rm(temporaryPath, { force: true });
    this.setState({
      status: "downloading",
      currentVersion: this.state.currentVersion,
      latestVersion: release.version,
      progress: 0,
    });
    try {
      const checksum = await this.fetchChecksum(release.checksum.browser_download_url);
      const response = await fetch(release.asar.browser_download_url, {
        redirect: "follow",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      });
      if (!response.ok || !response.body) throw new Error("Update download failed");
      const file = await open(temporaryPath, "w", 0o600);
      const hash = createHash("sha256");
      let downloaded = 0;
      try {
        for await (const chunk of response.body) {
          const bytes = Buffer.from(chunk);
          downloaded += bytes.length;
          if (downloaded > MAX_ASAR_BYTES) throw new Error("Update exceeds size limit");
          hash.update(bytes);
          await file.write(bytes);
          this.setState({
            status: "downloading",
            currentVersion: this.state.currentVersion,
            latestVersion: release.version,
            progress: Math.min(99, Math.round((downloaded / release.asar.size) * 100)),
          });
        }
      } finally {
        await file.close();
      }
      if (downloaded !== release.asar.size || hash.digest("hex") !== checksum) {
        throw new Error("Update integrity check failed");
      }
      validateAsar(temporaryPath, release.version);
      await rename(temporaryPath, finalPath);
      const store = readUpdateStore(userDataPath);
      store.staged = { version: release.version, asarPath: finalPath };
      writeUpdateStore(userDataPath, store);
      return this.setState({
        status: "ready",
        currentVersion: this.state.currentVersion,
        latestVersion: release.version,
        progress: 100,
      });
    } catch {
      await rm(temporaryPath, { force: true });
      return this.setState({
        status: "downloadFailed",
        currentVersion: this.state.currentVersion,
        latestVersion: release.version,
        progress: 0,
      });
    }
  }

  private async fetchChecksum(url: string): Promise<string> {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(NETWORK_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error("Checksum download failed");
    const value = (await response.text()).trim().split(/\s+/)[0];
    if (!/^[a-f\d]{64}$/i.test(value)) throw new Error("Invalid checksum");
    return value.toLowerCase();
  }

  private setState(state: AppUpdateState): AppUpdateState {
    this.state = state;
    this.eventService.sendEvent(APP_UPDATE_EVENT, state);
    return state;
  }
}
