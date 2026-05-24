import { createWriteStream, existsSync } from "node:fs";
import { promises as fsPromises } from "node:fs";
import { join } from "node:path";
import type {
  CheckUpdateResponse,
  StartDownloadResponse,
  InstallUpdateResponse,
  UpdateStatusPayload,
} from "@shared/api";
import { UPDATE_STATUS_CHANGED } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { app, shell } from "electron";
import { EventService } from "./event.service";

@Injectable()
export class UpdateService {
  private status: UpdateStatusPayload["status"] = "idle";
  private progress = 0;
  private errorMsg?: string;

  private latestVersion = "";
  private releaseNotes = "";
  private downloadUrl = "";
  private tempFilePath = "";
  private updateType: "full" | "incremental" = "full";
  private expectedDownloadSize = 0;
  private isMock = false;

  private lastCheckTime = 0;
  private cachedCheckResult: CheckUpdateResponse | null = null;

  constructor(private eventService: EventService) {
    this.scheduleOldAsarCleanup();
  }

  private scheduleOldAsarCleanup() {
    setTimeout(async () => {
      try {
        const markerPath = join(app.getPath("userData"), ".update-marker.json");
        const oldAsarPath = join(process.resourcesPath, "app.asar.old");
        if (existsSync(markerPath)) {
          await fsPromises.unlink(markerPath);
          console.log("[UpdateService] Cleared update marker — update confirmed stable");
        }
        if (existsSync(oldAsarPath)) {
          await fsPromises.unlink(oldAsarPath);
          console.log("[UpdateService] Cleaned up app.asar.old");
        }
      } catch (error) {
        console.error("[UpdateService] Failed to clean up old assets:", error);
      }
    }, 60_000);
  }

  private broadcastStatus(status: UpdateStatusPayload["status"], progress = 0, errorMsg?: string) {
    this.status = status;
    this.progress = progress;
    this.errorMsg = errorMsg;
    console.log(
      `[UpdateService] Status → ${status}${progress ? ` (${progress}%)` : ""}${errorMsg ? ` error=${errorMsg}` : ""}`,
    );
    this.eventService.sendEvent(UPDATE_STATUS_CHANGED, {
      status,
      progress,
      errorMsg,
    } as UpdateStatusPayload);
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
    const [currMajor = 0, currMinor = 0, currPatch = 0] = parse(current);
    const [lateMajor = 0, lateMinor = 0, latePatch = 0] = parse(latest);

    if (lateMajor !== currMajor) return lateMajor > currMajor;
    if (lateMinor !== currMinor) return lateMinor > currMinor;
    return latePatch > currPatch;
  }

  private getUpdateType(current: string, latest: string, assets: any[]): "full" | "incremental" {
    const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
    const [currMajor = 0] = parse(current);
    const [lateMajor = 0] = parse(latest);

    if (lateMajor > currMajor) {
      return "full";
    }

    const hasAsar = assets.some((asset: any) => asset.name === "app.asar");
    return hasAsar ? "incremental" : "full";
  }

  private async validateAsarFile(
    filePath: string,
    expectedSize?: number,
  ): Promise<{ valid: boolean; error?: string }> {
    console.log(
      `[UpdateService] Validating asar: path=${filePath}, expectedSize=${expectedSize ?? "N/A"}`,
    );
    try {
      const stat = await fsPromises.stat(filePath);
      console.log(`[UpdateService] Asar file size: ${stat.size} bytes`);

      if (stat.size === 0) {
        return { valid: false, error: "File is empty" };
      }
      if (expectedSize && expectedSize > 0 && stat.size !== expectedSize) {
        return {
          valid: false,
          error: `Size mismatch: expected ${expectedSize}, got ${stat.size}`,
        };
      }

      const fd = await fsPromises.open(filePath, "r");
      try {
        // Asar uses Chromium Pickle format:
        //   [0..3]  UInt32LE  size-pickle payload (always 4)
        //   [4..7]  UInt32LE  header-buffer length
        //   [8..11] UInt32LE  header-pickle payload size
        //   [12..15] UInt32LE header-string length
        //   [16..]  UTF-8     header JSON string
        const buf = Buffer.alloc(16);
        const { bytesRead } = await fd.read(buf, 0, 16, 0);
        if (bytesRead < 16) {
          return {
            valid: false,
            error: `File too small to contain asar header (read ${bytesRead} bytes)`,
          };
        }

        const sizePicklePayload = buf.readUInt32LE(0);
        const headerBufLen = buf.readUInt32LE(4);
        const headerPicklePayload = buf.readUInt32LE(8);
        const headerStrLen = buf.readUInt32LE(12);
        console.log(
          `[UpdateService] Asar header: sizePickle=${sizePicklePayload}, headerBufLen=${headerBufLen}, headerPickle=${headerPicklePayload}, headerStrLen=${headerStrLen}`,
        );

        if (sizePicklePayload !== 4) {
          return { valid: false, error: `Invalid size-pickle payload: ${sizePicklePayload}` };
        }
        if (headerBufLen === 0 || headerBufLen > stat.size) {
          return { valid: false, error: `Invalid header buffer length: ${headerBufLen}` };
        }
        if (headerStrLen === 0 || headerStrLen > headerBufLen) {
          return { valid: false, error: `Invalid header string length: ${headerStrLen}` };
        }

        const headerBuf = Buffer.alloc(headerStrLen);
        const { bytesRead: hRead } = await fd.read(headerBuf, 0, headerStrLen, 16);
        if (hRead < headerStrLen) {
          return {
            valid: false,
            error: `Truncated header data (read ${hRead}/${headerStrLen} bytes)`,
          };
        }

        const header = JSON.parse(headerBuf.toString("utf-8"));
        if (!header.files || typeof header.files !== "object") {
          return { valid: false, error: "Asar header missing 'files' field" };
        }

        const fileCount = Object.keys(header.files).length;
        console.log(`[UpdateService] Asar validation passed — ${fileCount} top-level entries`);
        return { valid: true };
      } finally {
        await fd.close();
      }
    } catch (error) {
      console.error("[UpdateService] Asar validation exception:", error);
      return {
        valid: false,
        error: error instanceof Error ? error.message : "Validation failed",
      };
    }
  }

  async checkUpdate(force = false): Promise<CheckUpdateResponse> {
    console.log(`[UpdateService] checkUpdate called (force=${force})`);
    const now = Date.now();
    if (!force && this.cachedCheckResult && now - this.lastCheckTime < 10 * 60 * 1000) {
      console.log(
        "[UpdateService] Using cached update check result (age=%dms)",
        now - this.lastCheckTime,
      );
      if (this.cachedCheckResult.hasUpdate) {
        this.status = "available";
        if (this.cachedCheckResult.updateType) {
          this.updateType = this.cachedCheckResult.updateType;
        }
      } else {
        this.status = "idle";
      }
      return this.cachedCheckResult;
    }

    this.broadcastStatus("checking");

    try {
      const currentVersion = app.getVersion();
      console.log(
        `[UpdateService] Current version: ${currentVersion}, isPackaged: ${app.isPackaged}`,
      );

      let response: Response;
      let usingFallback = false;

      try {
        response = await fetch("https://leolun.github.io/willow/latest.json", {
          headers: {
            "User-Agent": `willow-desktop/${currentVersion}`,
          },
        });
        if (!response.ok) {
          throw new Error(`GitHub Pages returned status ${response.status}`);
        }
      } catch (pagesError) {
        console.warn(
          "[UpdateService] GitHub Pages update check failed, falling back to GitHub API:",
          pagesError,
        );
        usingFallback = true;
        response = await fetch("https://api.github.com/repos/LeoLun/willow/releases/latest", {
          headers: {
            "User-Agent": `willow-desktop/${currentVersion}`,
          },
        });
      }

      let release: any;
      console.log(
        `[UpdateService] Fetch response: status=${response.status}, usingFallback=${usingFallback}`,
      );
      if (!response.ok) {
        if (!app.isPackaged) {
          console.warn("[UpdateService] GitHub API error, enabling mock update for development");
          this.isMock = true;
          const versionParts = currentVersion.replace(/^v/, "").split(".").map(Number);
          const nextPatch = (versionParts[2] || 0) + 1;
          const mockVersion = `v${versionParts[0] || 1}.${versionParts[1] || 0}.${nextPatch}`;
          release = {
            tag_name: mockVersion,
            body: "### 这是一个 Mock 的增量更新\n- 修复了配置页面白屏的问题\n- 支持热更新与重启即用\n- 优化了内存占用",
            published_at: new Date().toISOString(),
            assets: [
              {
                name: "app.asar",
                browser_download_url: "mock://app.asar",
              },
            ],
          };
        } else {
          if (usingFallback && response.status === 403) {
            throw new Error("检查更新请求过快，已被 GitHub 限制，请稍后再试（限流错误）");
          }
          throw new Error(`Failed to fetch release: ${response.statusText}`);
        }
      } else {
        this.isMock = false;
        release = (await response.json()) as any;
      }

      const latestTag = release.tag_name || "";
      console.log(
        `[UpdateService] Latest tag: ${latestTag}, assets count: ${(release.assets || []).length}`,
      );
      let result: CheckUpdateResponse;

      if (this.isNewerVersion(currentVersion, latestTag)) {
        const assets = release.assets || [];
        this.updateType = this.getUpdateType(currentVersion, latestTag, assets);
        console.log(
          `[UpdateService] Update available: ${currentVersion} → ${latestTag}, type=${this.updateType}`,
        );

        let targetAsset: any = null;

        if (this.updateType === "incremental") {
          targetAsset = assets.find((asset: any) => asset.name === "app.asar");
          this.tempFilePath = join(app.getPath("temp"), "app.asar.tmp");
        } else {
          // Full updates match the CPU architecture for the DMG
          const arch = process.arch; // 'arm64' or 'x64'
          targetAsset = assets.find((asset: any) => {
            const name = asset.name.toLowerCase();
            const isDmg = name.endsWith(".dmg");
            if (!isDmg) return false;
            if (arch === "arm64") {
              return name.includes("arm64");
            } else {
              return name.includes("x64") || !name.includes("arm64");
            }
          });
          this.tempFilePath = join(app.getPath("temp"), `willow-update-${latestTag}-${arch}.dmg`);
        }

        if (!targetAsset) {
          console.error(
            `[UpdateService] No matching asset for updateType=${this.updateType}, available:`,
            assets.map((a: any) => a.name),
          );
          throw new Error(`没有找到适用于当前更新模式 (${this.updateType}) 的安装资产`);
        }

        this.latestVersion = latestTag;
        this.releaseNotes = release.body || "";
        this.downloadUrl = targetAsset.browser_download_url;
        console.log(
          `[UpdateService] Target asset: ${targetAsset.name}, url=${this.downloadUrl}, tempPath=${this.tempFilePath}`,
        );

        this.broadcastStatus("available");
        result = {
          hasUpdate: true,
          latestVersion: latestTag,
          currentVersion,
          updateType: this.updateType,
          releaseNotes: this.releaseNotes,
          publishDate: release.published_at,
        };
      } else {
        this.broadcastStatus("idle");
        result = {
          hasUpdate: false,
          latestVersion: currentVersion,
          currentVersion,
        };
      }

      this.cachedCheckResult = result;
      this.lastCheckTime = now;
      return result;
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : "检查更新失败";
      this.broadcastStatus("error", 0, msg);
      const currentVersion = app.getVersion();
      return {
        hasUpdate: false,
        latestVersion: currentVersion,
        currentVersion,
      };
    }
  }

  async startDownload(): Promise<StartDownloadResponse> {
    console.log(
      `[UpdateService] startDownload: status=${this.status}, url=${this.downloadUrl}, isMock=${this.isMock}`,
    );
    if (this.status !== "available" && this.status !== "error") {
      throw new Error("当前状态无法下载更新");
    }

    this.broadcastStatus("downloading", 0);

    if (this.isMock) {
      console.log("[UpdateService] Using mock download simulation");
      return new Promise<StartDownloadResponse>((resolve) => {
        let downloadedPercent = 0;
        const interval = setInterval(() => {
          downloadedPercent += 10;
          if (downloadedPercent >= 100) {
            clearInterval(interval);
            this.broadcastStatus("downloaded", 100);
            resolve({ success: true });
          } else {
            this.broadcastStatus("downloading", downloadedPercent);
          }
        }, 150);
      });
    }

    let fileStream: any = null;
    let reader: any = null;
    try {
      console.log(`[UpdateService] Fetching download: ${this.downloadUrl}`);
      const response = await fetch(this.downloadUrl);
      if (!response.ok) {
        throw new Error(`下载安装包失败: ${response.statusText} (${response.status})`);
      }

      const totalBytes = parseInt(response.headers.get("content-length") || "0", 10);
      this.expectedDownloadSize = totalBytes;
      console.log(
        `[UpdateService] Download response: status=${response.status}, content-length=${totalBytes}, dest=${this.tempFilePath}`,
      );
      if (!response.body) {
        throw new Error("下载响应体为空");
      }

      let downloadedBytes = 0;
      fileStream = createWriteStream(this.tempFilePath);

      reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          const chunk = Buffer.from(value);
          const isWritable = fileStream.write(chunk);
          if (!isWritable) {
            await new Promise<void>((resolve) => fileStream.once("drain", resolve));
          }
          downloadedBytes += chunk.length;
          const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          this.broadcastStatus("downloading", progress);
        }
      }

      await new Promise<void>((resolve, reject) => {
        fileStream.on("finish", resolve);
        fileStream.on("error", reject);
        fileStream.end();
      });

      if (this.expectedDownloadSize > 0) {
        const stat = await fsPromises.stat(this.tempFilePath);
        console.log(
          `[UpdateService] Download size check: expected=${this.expectedDownloadSize}, actual=${stat.size}`,
        );
        if (stat.size !== this.expectedDownloadSize) {
          throw new Error(
            `下载文件大小不匹配: 期望 ${this.expectedDownloadSize} 字节, 实际 ${stat.size} 字节`,
          );
        }
      } else {
        const stat = await fsPromises.stat(this.tempFilePath);
        console.log(
          `[UpdateService] Download complete (no content-length): actual size=${stat.size}`,
        );
      }

      this.broadcastStatus("downloaded", 100);
      return { success: true };
    } catch (error: any) {
      if (reader) {
        try {
          await reader.cancel();
        } catch {}
      }
      if (fileStream) {
        fileStream.destroy();
      }
      try {
        if (existsSync(this.tempFilePath)) {
          await fsPromises.unlink(this.tempFilePath);
        }
      } catch {}

      const msg = error instanceof Error ? error.message : "下载安装包失败";
      this.broadcastStatus("error", 0, msg);
      throw error;
    }
  }

  async installUpdate(): Promise<InstallUpdateResponse> {
    console.log(
      `[UpdateService] installUpdate: status=${this.status}, updateType=${this.updateType}, tempFile=${this.tempFilePath}`,
    );
    if (this.status !== "downloaded") {
      throw new Error("更新包尚未下载完成");
    }

    try {
      if (this.updateType === "full") {
        console.log(`[UpdateService] Full update — opening DMG: ${this.tempFilePath}`);
        await shell.openPath(this.tempFilePath);
        return { success: true };
      } else {
        if (!app.isPackaged) {
          console.log("[UpdateService] Dev mode — simulating relaunch via window reload");
          const { BrowserWindow } = require("electron");
          BrowserWindow.getAllWindows().forEach((win: any) => {
            win.webContents.reloadIgnoringCache();
          });
          return { success: true };
        }

        console.log("[UpdateService] Incremental update — starting asar replacement");
        const appAsarPath = join(process.resourcesPath, "app.asar");
        const oldAsarPath = join(process.resourcesPath, "app.asar.old");
        console.log(`[UpdateService] Paths: appAsar=${appAsarPath}, oldAsar=${oldAsarPath}`);

        console.log("[UpdateService] Step 1/5: Validating downloaded asar");
        const validation = await this.validateAsarFile(
          this.tempFilePath,
          this.expectedDownloadSize,
        );
        if (!validation.valid) {
          throw new Error(`更新包验证失败: ${validation.error}`);
        }

        const safeMove = async (src: string, dest: string, label: string) => {
          const srcStat = await fsPromises.stat(src);
          console.log(
            `[UpdateService] safeMove [${label}]: ${src} (${srcStat.size} bytes) → ${dest}`,
          );
          try {
            await fsPromises.rename(src, dest);
            console.log(`[UpdateService] safeMove [${label}]: rename succeeded`);
          } catch (err: any) {
            if (err.code === "EXDEV") {
              console.log(`[UpdateService] safeMove [${label}]: EXDEV, falling back to copyFile`);
              await fsPromises.copyFile(src, dest);
              await fsPromises.unlink(src);
              console.log(`[UpdateService] safeMove [${label}]: copyFile+unlink succeeded`);
            } else {
              throw err;
            }
          }

          try {
            const handle = await fsPromises.open(dest, "r+");
            await handle.sync();
            await handle.close();
            const destStat = await fsPromises.stat(dest);
            console.log(
              `[UpdateService] safeMove [${label}]: fsync done, dest size=${destStat.size} bytes`,
            );
          } catch (syncError) {
            console.warn(`[UpdateService] safeMove [${label}]: fsync failed:`, syncError);
          }
        };

        console.log("[UpdateService] Step 2/5: Backing up current app.asar");
        if (existsSync(appAsarPath)) {
          await safeMove(appAsarPath, oldAsarPath, "backup");
        } else {
          console.warn("[UpdateService] No existing app.asar to back up");
        }

        console.log("[UpdateService] Step 3/5: Installing new app.asar");
        await safeMove(this.tempFilePath, appAsarPath, "install");

        console.log("[UpdateService] Step 4/5: Writing update marker");
        try {
          const markerPath = join(app.getPath("userData"), ".update-marker.json");
          const markerData = { version: this.latestVersion, timestamp: Date.now(), attempts: 0 };
          await fsPromises.writeFile(markerPath, JSON.stringify(markerData));
          console.log(`[UpdateService] Marker written: ${JSON.stringify(markerData)}`);
        } catch (markerErr) {
          console.warn("[UpdateService] Failed to write update marker:", markerErr);
        }

        console.log("[UpdateService] Step 5/5: Relaunching app");
        app.relaunch();
        await new Promise<void>((resolve) => setTimeout(resolve, 500));
        console.log("[UpdateService] Calling app.exit(0)");
        app.exit(0);
        return { success: true };
      }
    } catch (error: any) {
      console.error("[UpdateService] installUpdate failed:", error);
      throw new Error(`应用更新失败: ${error.message}`);
    }
  }
}
