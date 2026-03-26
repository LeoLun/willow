import { On, WindowFactoryResolver, Module } from "@willow/poetry";
import { app, BrowserWindow } from "electron";
import started from "electron-squirrel-startup";
import { AddModelController } from "./controllers/config/add.model.controller";
import { DeleteModelController } from "./controllers/config/delete.model.controller";
import { GetModelListController } from "./controllers/config/get.model.list.controller";
import { SetDefaultModelController } from "./controllers/config/set.default.model.controller";
import { UpdateModelController } from "./controllers/config/update.model.controller";
import { DialogController } from "./controllers/dialog.controller";
import { EventController } from "./controllers/event.controller";
import { InitController } from "./controllers/init.controller";
import { CreateSessionController } from "./controllers/session/create.session.controller";
import { DeleteSessionController } from "./controllers/session/delete.session.controller";
import { GetSessionHistoryController } from "./controllers/session/get.session.history.controller";
import { GetSessionListController } from "./controllers/session/get.session.list.controller";
import { RenameSessionController } from "./controllers/session/rename.session.controller";
import { SendMessageController } from "./controllers/session/send.messgae.controller";
import { CreateWorkspaceController } from "./controllers/workspace/create.workspace.controll";
import { DeleteWorkspaceController } from "./controllers/workspace/delete.workspace.controll";
import { GetWorkspaceInfoController } from "./controllers/workspace/get.workspace.info.controll";
import { GetWorkspaceListController } from "./controllers/workspace/get.workspace.list.controll";
import { RenameWorkspaceController } from "./controllers/workspace/rename.workspace.controll";
import { AgentService } from "./service/agent.service";
import { ConfigService } from "./service/config.service";
import { ModelDao } from "./service/dao/model.dao.service";
import { SessionMessageDao } from "./service/dao/session-message.dao.service";
import { SessionDao } from "./service/dao/session.dao.service";
import { WorkspaceDao } from "./service/dao/workspace.dao.service";
import { DbService } from "./service/db.service";
import { EventService } from "./service/event.service";
import { SessionService } from "./service/session.service";
import { SystemService } from "./service/system.service";
import { WorkspaceService } from "./service/workspace.service";
import { MainWindow } from "./window/main.window";

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
    ConfigService,
    WorkspaceDao,
    SessionDao,
    SessionMessageDao,
    ModelDao,
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
    GetModelListController,
    AddModelController,
    UpdateModelController,
    DeleteModelController,
    SetDefaultModelController,
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
    private getModelListController: GetModelListController,
    private addModelController: AddModelController,
    private updateModelController: UpdateModelController,
    private deleteModelController: DeleteModelController,
    private setDefaultModelController: SetDefaultModelController,
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
