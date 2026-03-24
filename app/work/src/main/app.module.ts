import { On, WindowFactoryResolver, Module, IPC } from "@willow/poetry";
import { MainWindow } from "./window/main.window";
import { app, BrowserWindow } from "electron";
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
import { RenameWorkspaceController } from "./controllers/workspace/rename.workspace.controll";
import { CreateSessionController } from "./controllers/session/create.session.controller";
import { SendMessageController } from "./controllers/session/send.messgae.controller";
import { GetSessionListController } from "./controllers/session/get.session.list.controller";
import { GetSessionHistoryController } from "./controllers/session/get.session.history.controller";
import { RenameSessionController } from "./controllers/session/rename.session.controller";
import { DeleteSessionController } from "./controllers/session/delete.session.controller";
import { AgentService } from "./service/agent.service";
import { EventService } from "./service/event.service";
import { EventController } from "./controllers/event.controller";

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
    AgentService,
    WorkspaceDao,
    SessionDao,
    SessionMessageDao,
    EventService,
  ],
  controllers: [
    InitController,
    DialogController,
    GetWorkspaceListController,
    CreateWorkspaceController,
    DeleteWorkspaceController,
    GetWorkspaceInfoController,
    RenameWorkspaceController,
    CreateSessionController,
    SendMessageController,
    GetSessionListController,
    GetSessionHistoryController,
    RenameSessionController,
    DeleteSessionController,
    EventController,
  ],
})
export class AppModule {
  constructor(
    private windowFactoryResolver: WindowFactoryResolver,
    private initController: InitController,
    private dialogController: DialogController,
    private getWorkspaceListController: GetWorkspaceListController,
    private createWorkspaceController: CreateWorkspaceController,
    private deleteWorkspaceController: DeleteWorkspaceController,
    private getWorkspaceInfoController: GetWorkspaceInfoController,
    private renameWorkspaceController: RenameWorkspaceController,
    private createSessionController: CreateSessionController,
    private sendMessageController: SendMessageController,
    private getSessionListController: GetSessionListController,
    private getSessionHistoryController: GetSessionHistoryController,
    private renameSessionController: RenameSessionController,
    private deleteSessionController: DeleteSessionController,
    private eventController: EventController,
  ) {}

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
}
