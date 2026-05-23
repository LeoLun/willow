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
  private isMock = false;

  constructor(private eventService: EventService) {
    this.cleanupOldAsar();
  }

  private async cleanupOldAsar() {
    try {
      const oldAsarPath = join(process.resourcesPath, "app.asar.old");
      if (existsSync(oldAsarPath)) {
        await fsPromises.unlink(oldAsarPath);
        console.log("Successfully cleaned up app.asar.old");
      }
    } catch (error) {
      console.error("Failed to clean up app.asar.old:", error);
    }
  }

  private broadcastStatus(status: UpdateStatusPayload["status"], progress = 0, errorMsg?: string) {
    this.status = status;
    this.progress = progress;
    this.errorMsg = errorMsg;
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

  async checkUpdate(): Promise<CheckUpdateResponse> {
    this.broadcastStatus("checking");

    try {
      const response = await fetch("https://api.github.com/repos/LeoLun/willow/releases/latest", {
        headers: {
          "User-Agent": "willow-updater",
        },
      });

      let release: any;
      const currentVersion = app.getVersion();

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
          throw new Error(`Failed to fetch release: ${response.statusText}`);
        }
      } else {
        this.isMock = false;
        release = (await response.json()) as any;
      }

      const latestTag = release.tag_name || "";

      if (this.isNewerVersion(currentVersion, latestTag)) {
        const assets = release.assets || [];
        this.updateType = this.getUpdateType(currentVersion, latestTag, assets);

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
          throw new Error(`没有找到适用于当前更新模式 (${this.updateType}) 的安装资产`);
        }

        this.latestVersion = latestTag;
        this.releaseNotes = release.body || "";
        this.downloadUrl = targetAsset.browser_download_url;

        this.broadcastStatus("available");
        return {
          hasUpdate: true,
          latestVersion: latestTag,
          currentVersion,
          updateType: this.updateType,
          releaseNotes: this.releaseNotes,
          publishDate: release.published_at,
        };
      } else {
        this.broadcastStatus("idle");
        return {
          hasUpdate: false,
          latestVersion: currentVersion,
          currentVersion,
        };
      }
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
    if (this.status !== "available" && this.status !== "error") {
      throw new Error("当前状态无法下载更新");
    }

    this.broadcastStatus("downloading", 0);

    if (this.isMock) {
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

    try {
      const response = await fetch(this.downloadUrl);
      if (!response.ok) {
        throw new Error(`下载安装包失败: ${response.statusText}`);
      }

      const totalBytes = parseInt(response.headers.get("content-length") || "0", 10);
      if (!response.body) {
        throw new Error("下载响应体为空");
      }

      let downloadedBytes = 0;
      const fileStream = createWriteStream(this.tempFilePath);

      const reader = response.body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          fileStream.write(Buffer.from(value));
          downloadedBytes += value.length;
          const progress = totalBytes > 0 ? Math.round((downloadedBytes / totalBytes) * 100) : 0;
          this.broadcastStatus("downloading", progress);
        }
      }

      fileStream.end();
      this.broadcastStatus("downloaded", 100);
      return { success: true };
    } catch (error: any) {
      const msg = error instanceof Error ? error.message : "下载安装包失败";
      this.broadcastStatus("error", 0, msg);
      throw error;
    }
  }

  async installUpdate(): Promise<InstallUpdateResponse> {
    if (this.status !== "downloaded") {
      throw new Error("更新包尚未下载完成");
    }

    try {
      if (this.updateType === "full") {
        await shell.openPath(this.tempFilePath);
        return { success: true };
      } else {
        // Incremental Update: Replace app.asar and restart
        if (!app.isPackaged) {
          console.log("[UpdateService] Dev mode: simulation relaunch via window reload");
          const { BrowserWindow } = require("electron");
          BrowserWindow.getAllWindows().forEach((win: any) => {
            win.webContents.reloadIgnoringCache();
          });
          return { success: true };
        }

        const appAsarPath = join(process.resourcesPath, "app.asar");
        const oldAsarPath = join(process.resourcesPath, "app.asar.old");

        // Backup current app.asar
        if (existsSync(appAsarPath)) {
          await fsPromises.rename(appAsarPath, oldAsarPath);
        }

        // Copy downloaded temp app.asar to target path
        await fsPromises.rename(this.tempFilePath, appAsarPath);

        // Relaunch the application
        app.relaunch();
        app.exit(0);
        return { success: true };
      }
    } catch (error: any) {
      throw new Error(`应用更新失败: ${error.message}`);
    }
  }
}
