import "reflect-metadata";
import { BrowserWindow, app, ipcMain } from "electron";
import { Container, interfaces } from "inversify";
import {
  MODULE_METADATA,
  WINDOW_METADATA,
} from "../common/constants";
import { WindowFactoryResolver } from "./window-factory-resolver";
import { PropertysExplorer } from "./propertys-explorer";


export class CoreFactoryStatic {
  public async create(module: any) {
    const container = new Container({ defaultScope: "Singleton" });
    const instance = this.createModule(module, container);

    return instance
  }

  // 创建模块
  private async createModule(module: any, container: Container) {
    // 注入原生服务
    container.bind(WindowFactoryResolver).toDynamicValue(() => {
      return new WindowFactoryResolver(container);
    });

    // 获取所有的providers
    const providers = Reflect.getMetadata(MODULE_METADATA.PROVIDERS, module);
    // 将providers注册到容器
    providers &&
      providers.forEach((provider: any) => {
        container.bind(provider).toSelf();
      });

    // 获取所有的windows
    const windows = Reflect.getMetadata(MODULE_METADATA.WINDOWS, module);
    // 将 windows 注册到容器
    windows &&
      windows.forEach((window: any) => {
        container.bind(window).toSelf();
        container.onActivation(
          window,
          (context: interfaces.Context, result: any): any => {
            // 实例化窗口对象
            this.initWindow(window, result, container);
            result.onInit && result.onInit();
            return result;
          }
        );

        container.onDeactivation(window, async (result: any): Promise<any> => {
          return result.onDestroy && await result.onDestroy();
        });
      });

    // 获取所有的modules
    const modulesInstances = [];
    const modules = Reflect.getMetadata(MODULE_METADATA.IMPORTS, module);
    if (modules && modules.length !== 0) {
      modules.forEach((childModule: any) => {
        const childContainer = container.createChild();
        const moduleInstance = this.createModule(childModule, childContainer);
        // 获取子模块导出的providers
        const exports = Reflect.getMetadata(
          MODULE_METADATA.EXPORTS,
          childModule
        );
        // 实例化导出的providers
        exports.forEach((exportProvider: any) => {
          container.bind(exportProvider).toDynamicValue(() => {
            return childContainer.resolve(exportProvider);
          });
        });

        modulesInstances.push(moduleInstance);
      });
    }

    const instance = container.resolve(module) as any;
    this.initModule(module, instance);
    return instance;
  }


  private async initModule(module: any, instance: any) {
    // 添加app事件监听
    const propertysExplorer = new PropertysExplorer();
    const [propertys, events, ipcMethods] = propertysExplorer.scanForPropertys(instance);
    for (const event of events) {
      app.on(event.eventName, (...args) => {
        event.targetCallback.apply(instance, args);
      });
    }

    for (const event of ipcMethods) {
      // @TODO 优化改用 rxjs 监听, 以便于取消监听
      ipcMain.handle(event.eventName, (...args) => {
        return event.targetCallback.apply(instance, args);
      });
    }
  }

  private initWindow(window: any, instance: any, container: Container) {
    // 获取参数
    const options = Reflect.getMetadata(WINDOW_METADATA.OPTIONS, window);
    const loadFile = Reflect.getMetadata(WINDOW_METADATA.LOAD_FILE, window);
    const loadURL = Reflect.getMetadata(WINDOW_METADATA.LOAD_URL, window);
    const openDevTools = Reflect.getMetadata(
      WINDOW_METADATA.OPEN_DEV_TOOLS,
      window
    );
    if (!options) {
      return;
    }
    const browserWindow = new BrowserWindow(options);
    if (loadURL) {
      browserWindow.loadURL(loadURL);
    }

    if (loadFile) {
      browserWindow.loadFile(loadFile);
    }

    if (openDevTools) {
      browserWindow.webContents.openDevTools();
    }

    browserWindow.on("closed", async () => {
      await container.unbindAsync(window);
      container.bind(window).toSelf();
    });

    // 添加窗口事件监听
    const propertysExplorer = new PropertysExplorer();
    const [propertys, events] = propertysExplorer.scanForPropertys(instance);
    // 注入窗口对象实例
    for (const property of propertys) {
      Reflect.set(instance, property.propertyName, browserWindow);
    }
    for (const event of events) {
      browserWindow.on(event.eventName, (...args) => {
        event.targetCallback.apply(instance, args);
      });
    }

    return;
  }
}

export const CoreFactory = new CoreFactoryStatic();
