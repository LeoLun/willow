import { BrowserWindow } from "electron";
import { IModuleManager } from "../interfaces/manager/module-manager.interface";
import { IWindowManager } from "../interfaces/manager/window-manager.interface";


export class WindowManager implements IWindowManager {
  parentModuleManager: IModuleManager;
  window: BrowserWindow;

  constructor(parentModuleManager: IModuleManager, window: BrowserWindow) {
    this.parentModuleManager = parentModuleManager;
    this.window = window;
  }
}