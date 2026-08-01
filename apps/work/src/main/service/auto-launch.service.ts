import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, join, win32 } from "node:path";
import type { AutoLaunchState } from "@shared/api";
import { Injectable } from "@willow/poetry";
import { app } from "electron";

const AUTOSTART_FILE_NAME = "willow.desktop";

function escapeDesktopExecArgument(value: string): string {
  return value
    .replaceAll("\\", "\\\\")
    .replaceAll('"', '\\"')
    .replaceAll("`", "\\`")
    .replaceAll("$", "\\$")
    .replaceAll("%", "%%");
}

function desktopEntry(execPath: string): string {
  return [
    "[Desktop Entry]",
    "Type=Application",
    "Version=1.0",
    "Name=Willow",
    `Exec="${escapeDesktopExecArgument(execPath)}"`,
    "Terminal=false",
    "X-GNOME-Autostart-enabled=true",
    "",
  ].join("\n");
}

function parseDesktopEntry(contents: string): ReadonlyMap<string, string> {
  const values = new Map<string, string>();
  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (trimmed === "" || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
    const separator = trimmed.indexOf("=");
    if (separator <= 0) continue;
    values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1));
  }
  return values;
}

@Injectable()
export class AutoLaunchService {
  async getState(): Promise<AutoLaunchState> {
    if (!app.isPackaged || !this.isSupportedPlatform()) {
      return { enabled: false, supported: false, requiresApproval: false };
    }

    if (process.platform === "darwin") {
      const settings = app.getLoginItemSettings();
      const requiresApproval = settings.status === "requires-approval";
      return {
        enabled: settings.openAtLogin && !requiresApproval,
        supported: true,
        requiresApproval,
      };
    }

    if (process.platform === "win32") {
      const settings = app.getLoginItemSettings({ path: this.windowsLauncherPath() });
      return {
        enabled: settings.executableWillLaunchAtLogin,
        supported: true,
        requiresApproval: false,
      };
    }

    return {
      enabled: await this.getLinuxState(),
      supported: true,
      requiresApproval: false,
    };
  }

  async setEnabled(enabled: boolean): Promise<AutoLaunchState> {
    const current = await this.getState();
    if (!current.supported) return current;

    if (process.platform === "darwin") {
      app.setLoginItemSettings({ openAtLogin: enabled });
    } else if (process.platform === "win32") {
      app.setLoginItemSettings({
        enabled,
        openAtLogin: enabled,
        path: this.windowsLauncherPath(),
      });
    } else {
      await this.setLinuxEnabled(enabled);
    }

    return this.getState();
  }

  private isSupportedPlatform(): boolean {
    return (
      process.platform === "darwin" || process.platform === "win32" || process.platform === "linux"
    );
  }

  private windowsLauncherPath(): string {
    return win32.join(
      win32.dirname(win32.dirname(process.execPath)),
      win32.basename(process.execPath),
    );
  }

  private linuxAutostartPath(): string {
    const configuredHome = process.env.XDG_CONFIG_HOME;
    const configHome =
      configuredHome && isAbsolute(configuredHome) ? configuredHome : app.getPath("appData");
    return join(configHome, "autostart", AUTOSTART_FILE_NAME);
  }

  private async getLinuxState(): Promise<boolean> {
    let contents: string;
    try {
      contents = await readFile(this.linuxAutostartPath(), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return false;
      throw error;
    }

    const values = parseDesktopEntry(contents);
    return (
      values.get("Exec") === `"${escapeDesktopExecArgument(process.execPath)}"` &&
      values.get("Hidden")?.toLowerCase() !== "true" &&
      values.get("X-GNOME-Autostart-enabled")?.toLowerCase() !== "false"
    );
  }

  private async setLinuxEnabled(enabled: boolean): Promise<void> {
    const filePath = this.linuxAutostartPath();
    if (!enabled) {
      try {
        await unlink(filePath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
      return;
    }

    await mkdir(dirname(filePath), { mode: 0o700, recursive: true });
    const temporaryPath = `${filePath}.tmp-${randomUUID()}`;
    try {
      await writeFile(temporaryPath, desktopEntry(process.execPath), { flag: "wx", mode: 0o644 });
      await rename(temporaryPath, filePath);
    } catch (error) {
      await unlink(temporaryPath).catch(() => undefined);
      throw error;
    }
  }
}
