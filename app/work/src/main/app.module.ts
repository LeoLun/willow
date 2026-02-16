import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { MainWindow } from "./window/main.window";
import { app, BrowserWindow } from "electron";
import type { IEcho } from "@shared/index";
import { ECHO } from "@shared/index";
import started from "electron-squirrel-startup";
import { SystemService } from "./service/system.service";
import { OpencodeService } from "./service/opencode.service";
import { OpencodeController } from "./controllers/opencode.controller";
import { InitController } from "./controllers/init.controller";
import { DialogController } from "./controllers/dialog.controller";
import { WorkspaceService } from "./service/workspace.service";

if (started) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow],
  providers: [WorkspaceService, SystemService, OpencodeService],
  controllers: [InitController, OpencodeController, DialogController],
})
export class AppModule implements IEcho {
  private windowFactoryResolver: WindowFactoryResolver;
  private opencodeController: OpencodeController;
  private initController: InitController;
  private dialogController: DialogController;

  constructor(
    windowFactoryResolver: WindowFactoryResolver,
    opencodeController: OpencodeController,
    initController: InitController,
    dialogController: DialogController,
  ) {
    console.log("windowFactoryResolver", windowFactoryResolver);
    this.windowFactoryResolver = windowFactoryResolver;
    this.opencodeController = opencodeController;
    this.initController = initController;
    this.dialogController = dialogController;
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  async onReady() {
    this.createWindow();
  }

  @On("before-quit")
  async onBeforeQuit() {
    console.log("onBeforeQuit");
    await this.opencodeController.stopOpencode();
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

  @IPC(ECHO)
  async echo() {
    // const message = await this.echoService.echo("hello world");
    return {
      message: "hello world",
    };
  }
}
