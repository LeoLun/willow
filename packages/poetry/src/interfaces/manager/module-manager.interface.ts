import { IWindowManager } from "./window-manager.interface";

export interface IModuleManager {
  module: any;
  windowManagerMap: WeakMap<any, IWindowManager>;
  parentModuleManager: IModuleManager | undefined;
  childModuleManagers: IModuleManager[];

  setModule(module: any): void;
  addWindow(window: any, instance: any): void;
}
