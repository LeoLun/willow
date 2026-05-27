import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { FloatingBallConfig } from "@shared/api";
import { Injectable, WindowFactoryResolver } from "@willow/poetry";
import { app } from "electron";
import { FloatingBallWindow } from "../window/floating-ball.window";
import { MainWindow } from "../window/main.window";

@Injectable()
export class FloatingBallService {
  private configPath = join(app.getPath("userData"), "floating-ball.json");
  private config: FloatingBallConfig = { enabled: false, x: -1, y: -1 };

  constructor(private windowFactoryResolver: WindowFactoryResolver) {}

  async init() {
    try {
      const data = await readFile(this.configPath, "utf-8");
      const parsed = JSON.parse(data);
      this.config = { ...this.config, ...parsed };
    } catch {
      // Ignored if file doesn't exist
    }
    if (this.config.x < 0 || this.config.y < 0) {
      try {
        const { screen } = require("electron");
        const primaryDisplay = screen.getPrimaryDisplay();
        const workArea = primaryDisplay.workArea;
        // Default size of floating ball is 80x80. Place it in the bottom right corner.
        this.config.x = Math.round(workArea.x + workArea.width - 80 - 40); // 40px margin from right
        this.config.y = Math.round(workArea.y + workArea.height - 80 - 100); // 100px margin from bottom
        await this.save();
      } catch (e) {
        console.error("Failed to calculate default position for floating ball", e);
      }
    }
    if (this.config.enabled) {
      this.spawnWindow();
    }
  }

  private async save() {
    await writeFile(this.configPath, JSON.stringify(this.config), "utf-8");
  }

  getConfig() {
    return this.config;
  }

  async setEnabled(enabled: boolean) {
    this.config.enabled = enabled;
    await this.save();

    if (enabled) {
      this.spawnWindow();
    } else {
      const win = FloatingBallWindow.getInstance();
      if (win) {
        win.close();
      }
    }
  }

  async setPosition(x: number, y: number) {
    this.config.x = Math.round(x);
    this.config.y = Math.round(y);
    await this.save();
  }

  moveWindow(x: number, y: number) {
    const instance = FloatingBallWindow.getInstance();
    if (instance) {
      instance.setPosition(Math.round(x), Math.round(y));
    }
  }

  resizeWindow(width: number, height: number, focusable?: boolean, isLeft?: boolean) {
    const instance = FloatingBallWindow.getInstance();
    if (!instance) return;

    const win = instance.BrowserWindow;
    if (!win || win.isDestroyed()) return;

    // Set focusable state and focus if requested
    if (typeof focusable === "boolean") {
      win.setFocusable(focusable);
      if (focusable) {
        win.focus();
      }
    }

    const { screen } = require("electron");
    const oldBounds = win.getBounds();
    const currentDisplay = screen.getDisplayMatching(oldBounds);
    const workArea = currentDisplay.workArea;

    const displayCenterX = workArea.x + workArea.width / 2;
    const finalIsLeft =
      typeof isLeft === "boolean" ? isLeft : oldBounds.x + oldBounds.width / 2 < displayCenterX;

    let newX = finalIsLeft ? oldBounds.x : oldBounds.x + oldBounds.width - width;
    let newY = oldBounds.y + oldBounds.height - height;

    // Clamp newX to workArea bounds
    if (newX < workArea.x) {
      newX = workArea.x;
    } else if (newX + width > workArea.x + workArea.width) {
      newX = workArea.x + workArea.width - width;
    }

    // Clamp newY to workArea bounds
    if (newY < workArea.y) {
      newY = workArea.y;
    } else if (newY + height > workArea.y + workArea.height) {
      newY = workArea.y + workArea.height - height;
    }

    const rx = Math.round(newX);
    const ry = Math.round(newY);
    win.setBounds({
      x: rx,
      y: ry,
      width: Math.round(width),
      height: Math.round(height),
    });
    return { x: rx, y: ry };
  }

  showMainWindow() {
    const mainWindow = this.windowFactoryResolver.resolveWindowFactory(MainWindow);
    if (mainWindow && mainWindow.win) {
      if (mainWindow.win.isMinimized()) mainWindow.win.restore();
      mainWindow.win.show();
      mainWindow.win.focus();
    }
  }

  private spawnWindow() {
    this.windowFactoryResolver.resolveWindowFactory(FloatingBallWindow);
    // Note: the window instances are mapped inside the controller or wrapper
    const instance = FloatingBallWindow.getInstance();
    if (instance) {
      const browserWindow = instance.BrowserWindow;

      // Ensure the window is within bounds before setting position
      if (this.config.x >= 0 && this.config.y >= 0 && browserWindow) {
        const { screen } = require("electron");
        const displays = screen.getAllDisplays();
        const isWithinBounds = displays.some((display) => {
          const bounds = display.bounds;
          return (
            this.config.x >= bounds.x &&
            this.config.x <= bounds.x + bounds.width &&
            this.config.y >= bounds.y &&
            this.config.y <= bounds.y + bounds.height
          );
        });

        if (isWithinBounds) {
          instance.setPosition(this.config.x, this.config.y);
        }
      }

      if (browserWindow) {
        let moveTimeout: NodeJS.Timeout;
        browserWindow.on("move", () => {
          clearTimeout(moveTimeout);
          moveTimeout = setTimeout(() => {
            if (!browserWindow.isDestroyed()) {
              const [x, y] = browserWindow.getPosition();
              this.setPosition(x, y);
            }
          }, 300);
        });
      }
    }
  }
}
