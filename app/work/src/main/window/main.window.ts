import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "path";
import { Window, WindowInstance, OnInit, On, OnDestroy, WindowMetadata } from "@willow/poetry";
import { app, BrowserWindow } from "electron";

const windowStatePath = join(app.getPath("userData"), "window-state.json");
let savedBounds: {
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
} = {};
try {
  if (existsSync(windowStatePath)) {
    savedBounds = JSON.parse(readFileSync(windowStatePath, "utf-8"));
  }
} catch (e) {
  console.error("Failed to load window state:", e);
}

const option: WindowMetadata = {
  options: {
    height: savedBounds.height || 800,
    width: savedBounds.width || 1200,
    ...(savedBounds.x !== undefined && savedBounds.y !== undefined
      ? { x: savedBounds.x, y: savedBounds.y }
      : {}),
    titleBarStyle: "hiddenInset",
    trafficLightPosition: {
      x: 10,
      y: 12,
    },
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      webSecurity: false,
    },
    ...(MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? { icon: join(__dirname, "../../assets/icons/icon.png") }
      : {}),
  },
  openDevTools: !app.isPackaged,
};

if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
  option.loadURL = MAIN_WINDOW_VITE_DEV_SERVER_URL;
} else {
  option.loadFile = join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`);
}

@Window(option)
export class MainWindow implements OnInit, OnDestroy {
  @WindowInstance()
  public win!: BrowserWindow;

  private isQuitting = false;
  private saveStateTimeout: NodeJS.Timeout | null = null;

  private readonly markQuitting = () => {
    this.isQuitting = true;
  };

  onInit() {
    console.log("OnInit");
    console.log("win", this.win);
    app.on("before-quit", this.markQuitting);

    if (savedBounds.isMaximized && this.win) {
      this.win.maximize();
    }
  }

  onDestroy() {
    console.log("onDestroy");
    app.off("before-quit", this.markQuitting);
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout);
    }
  }

  private saveState() {
    if (this.saveStateTimeout) {
      clearTimeout(this.saveStateTimeout);
    }
    this.saveStateTimeout = setTimeout(() => {
      if (this.win && !this.win.isDestroyed()) {
        try {
          const isMaximized = this.win.isMaximized();
          const state: any = { isMaximized };
          if (!isMaximized) {
            const bounds = this.win.getBounds();
            state.x = bounds.x;
            state.y = bounds.y;
            state.width = bounds.width;
            state.height = bounds.height;
          } else {
            let existing: any = {};
            try {
              if (existsSync(windowStatePath)) {
                existing = JSON.parse(readFileSync(windowStatePath, "utf-8"));
              }
            } catch {}
            state.x = existing.x;
            state.y = existing.y;
            state.width = existing.width;
            state.height = existing.height;
          }
          writeFileSync(windowStatePath, JSON.stringify(state), "utf-8");
        } catch (e) {
          console.error("Failed to save window state:", e);
        }
      }
    }, 500);
  }

  @On("resize")
  onResize() {
    this.saveState();
  }

  @On("move")
  onMove() {
    this.saveState();
  }

  @On("close")
  onClose(event: Electron.Event) {
    if (this.isQuitting) {
      return;
    }

    event.preventDefault();
    this.win.hide();
  }

  @On("show")
  onShow() {
    console.log("OnShow");
  }

  @On("hide")
  onHide() {
    console.log("OnHide");
  }
}
