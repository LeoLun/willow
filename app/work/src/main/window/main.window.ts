import { join } from "path";
import { Window, WindowInstance, OnInit, On, OnDestroy, WindowMetadata } from "@willow/poetry";
import { app, BrowserWindow } from "electron";

const option: WindowMetadata = {
  options: {
    height: 800,
    width: 1200,
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

  private readonly markQuitting = () => {
    this.isQuitting = true;
  };

  onInit() {
    console.log("OnInit");
    console.log("win", this.win);
    app.on("before-quit", this.markQuitting);
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
