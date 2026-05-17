import { join } from "path";
import { Window, WindowInstance, OnInit, OnDestroy, WindowMetadata } from "@willow/poetry";
import { BrowserWindow } from "electron";

const option: WindowMetadata = {
  options: {
    height: 80,
    width: 80,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    type: "panel",
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      webSecurity: false,
    },
  },
  openDevTools: true,
};

if (FLOATING_BALL_VITE_DEV_SERVER_URL) {
  option.loadURL = FLOATING_BALL_VITE_DEV_SERVER_URL;
} else {
  option.loadFile = join(__dirname, `../renderer/${FLOATING_BALL_VITE_NAME}/index.html`);
}

@Window(option)
export class FloatingBallWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win!: BrowserWindow;

  private static instance: FloatingBallWindow | null = null;

  onInit() {
    FloatingBallWindow.instance = this;
    try {
      this.win.setAlwaysOnTop(true, "status");
    } catch {}
  }

  onDestroy() {
    FloatingBallWindow.instance = null;
  }

  public static getInstance() {
    return FloatingBallWindow.instance;
  }

  public get BrowserWindow() {
    return this.win;
  }

  public close() {
    if (this.win && !this.win.isDestroyed()) {
      this.win.close();
    }
  }

  public setPosition(x: number, y: number) {
    if (this.win && !this.win.isDestroyed()) {
      this.win.setPosition(x, y);
    }
  }
}
