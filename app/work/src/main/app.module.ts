import { On, WindowFactoryResolver, Module, IPC } from "@willow/poetry";
import { MainWindow } from "./window/main.window";
import { app, BrowserWindow } from "electron";
import type { IEcho } from "@shared/index";
import { ECHO } from "@shared/index";
import started from "electron-squirrel-startup";
import { SystemService } from "./service/system.service";
import { DbService } from "./service/db.service";
import { InitController } from "./controllers/init.controller";
import { DialogController } from "./controllers/dialog.controller";
import { WorkspaceService } from "./service/workspace.service";
import { SessionService } from "./service/session.service";
import { WorkspaceDao } from "./service/dao/workspace.dao.service";
import { SessionDao } from "./service/dao/session.dao.service";
import { SessionMessageDao } from "./service/dao/session-message.dao.service";
import { GetWorkspaceListController } from "./controllers/workspace/get.workspace.list.controll";
import { CreateWorkspaceController } from "./controllers/workspace/create.workspace.controll";
import { DeleteWorkspaceController } from "./controllers/workspace/delete.workspace.controll";
import { GetWorkspaceInfoController } from "./controllers/workspace/get.workspace.info.controll";

if (started) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow],
  providers: [
    DbService,
    WorkspaceService,
    SystemService,
    SessionService,
    WorkspaceDao,
    SessionDao,
    SessionMessageDao,
  ],
  controllers: [
    InitController,
    DialogController,
    GetWorkspaceListController,
    CreateWorkspaceController,
    DeleteWorkspaceController,
    GetWorkspaceInfoController,
  ],
})
export class AppModule implements IEcho {
  private windowFactoryResolver: WindowFactoryResolver;
  private initController: InitController;
  private dialogController: DialogController;

  constructor(
    windowFactoryResolver: WindowFactoryResolver,
    initController: InitController,
    dialogController: DialogController,
    private getWorkspaceListController: GetWorkspaceListController,
    private createWorkspaceController: CreateWorkspaceController,
    private deleteWorkspaceController: DeleteWorkspaceController,
    private getWorkspaceInfoController: GetWorkspaceInfoController,
  ) {
    console.log("windowFactoryResolver", windowFactoryResolver);
    this.windowFactoryResolver = windowFactoryResolver;
    this.initController = initController;
    this.dialogController = dialogController;
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  async onReady() {
    this.initController.init();
    this.createWindow();
  }

  @On("before-quit")
  async onBeforeQuit() {
    console.log("onBeforeQuit");
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
