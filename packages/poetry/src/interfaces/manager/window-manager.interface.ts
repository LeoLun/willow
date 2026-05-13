import { BrowserWindow } from "electron";
import { IModuleManager } from "./module-manager.interface";

export interface IWindowManager {
  parentModuleManager: IModuleManager;
  window: BrowserWindow;
}
