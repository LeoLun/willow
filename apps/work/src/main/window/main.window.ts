import { join } from "path";
import { Window, WindowInstance, OnInit, On, OnDestroy, WindowMetadata } from "@willow/poetry";
import { app, BrowserWindow, type Rectangle } from "electron";
import { calculateDefaultWindowBounds } from "./default-window-bounds";

const option: WindowMetadata = {
  options: {
    minWidth: 1200,
    minHeight: 800,
    titleBarStyle: "hiddenInset",
    trafficLightPosition: {
      x: 20,
      y: 20,
    },
    webPreferences: {
      preload: join(__dirname, "preload.js"),
    },
    ...(MAIN_WINDOW_VITE_DEV_SERVER_URL
      ? { icon: join(__dirname, "../../assets/icons/icon-dev.png") }
      : {}),
  },
  openDevTools: !app.isPackaged,
};

export function configureMainWindowBounds(workArea: Rectangle) {
  Object.assign(option.options!, calculateDefaultWindowBounds(workArea));
}

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

  private readonly markQuitting = () => {
    this.isQuitting = true;
  };

  onInit() {
    console.log("OnInit");
    console.log("win", this.win);
    app.on("before-quit", this.markQuitting);

    this.win.webContents.on("console-message", (event, level, message, line, sourceId) => {
      console.log(`[RENDERER] ${message} (at ${sourceId}:${line})`);
    });
  }

  onDestroy() {
    console.log("onDestroy");
    app.off("before-quit", this.markQuitting);
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
