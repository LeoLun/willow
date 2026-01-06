import { Window, WindowInstance, OnInit, On, OnDestroy } from "poetry";

import { BrowserWindow } from "electron";
import path from "path";

const DIALOG_WINDOW_VITE_DEV_SERVER_URL = `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/dialog`;

type DialogWindowType = 'rename' | 'confirm';

@Window({
  options: {
    height: 400,
    width: 600,
    show: false,
    modal: true,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  },
  loadURL: `${MAIN_WINDOW_VITE_DEV_SERVER_URL}/dialog`,
})
export class DialogWindow implements OnInit, OnDestroy {
  @WindowInstance()
  private win: BrowserWindow;

  onInit() {
    console.log("OnInit");
    console.log("win", this.win);
  }

  onDestroy() {
    console.log("onDestroy");
  }

  show(parentWindow: BrowserWindow, type: DialogWindowType) {
    this.win.loadURL(`${DIALOG_WINDOW_VITE_DEV_SERVER_URL}?type=${type}`);
    this.win.setParentWindow(parentWindow);
    this.win.show();
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
