import { IModuleManager } from "../interfaces/manager/module-manager.interface";
import { IWindowManager } from "../interfaces/manager/window-manager.interface";

export class ModuleManager implements IModuleManager {
  module: any;
  windowManagerMap: WeakMap<any, IWindowManager>;
  parentModuleManager: IModuleManager | undefined;
  childModuleManagers: IModuleManager[];

  constructor(parentModuleManager?: IModuleManager) {
    this.parentModuleManager = parentModuleManager;
    this.windowManagerMap = new WeakMap();
    this.childModuleManagers = [];
  }

  setModule(module: any) {
    this.module = module;
  }

  addWindow(id: any, manager: IWindowManager) {
    this.windowManagerMap.set(id, manager);
  }
}
