import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { SomeService } from "./service/some.service";
import { MainWindow } from "./window/main.window";
import { SettingWindow } from "./window/setting.window";
import { app, BrowserWindow } from "electron";
import type {
  IOpenSettingWindowRequest,
  IOpenSettingWindowResponce,
  IOpenSettingWindow
} from "../shared";

import {
  OPEN_SETTING_WINDOW,
} from "../shared";

if (require("electron-squirrel-startup")) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow, SettingWindow],
  providers: [SomeService],
})
export class AppModule implements IOpenSettingWindow {
  private windowFactoryResolver: WindowFactoryResolver;

  constructor(windowFactoryResolver: WindowFactoryResolver) {
    this.windowFactoryResolver = windowFactoryResolver;
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  onReady() {
    this.createWindow();
  }

  @On("window-all-closed")
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  @On("activate")
  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    }
  }

  @IPC(OPEN_SETTING_WINDOW)
  async openSettingWindow(
    event: Electron.IpcMainEvent,
    request: IOpenSettingWindowRequest
  ): Promise<IOpenSettingWindowResponce> {
    console.log("openSettingWindow", request);
    this.windowFactoryResolver.resolveWindowFactory(SettingWindow);
    return { result: "success" };
  }
}
