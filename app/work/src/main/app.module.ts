import { On, WindowFactoryResolver, Module } from "@willow/poetry";
import { app, BrowserWindow, dialog as electronDialog } from "electron";
import started from "electron-squirrel-startup";
import { CreateAutomationController } from "./controllers/automation/create.automation.controller";
import { DeleteAutomationController } from "./controllers/automation/delete.automation.controller";
import { GetAutomationController } from "./controllers/automation/get.automation.controller";
import { GetAutomationListController } from "./controllers/automation/get.automation.list.controller";
import { UpdateAutomationController } from "./controllers/automation/update.automation.controller";
import { AddModelController } from "./controllers/config/add.model.controller";
import { AddTavilyKeyController } from "./controllers/config/add.tavily.key.controller";
import { DeleteModelController } from "./controllers/config/delete.model.controller";
import { DeleteTavilyKeyController } from "./controllers/config/delete.tavily.key.controller";
import { GetModelListController } from "./controllers/config/get.model.list.controller";
import { GetTavilyKeyListController } from "./controllers/config/get.tavily.key.list.controller";
import { SetDefaultModelController } from "./controllers/config/set.default.model.controller";
import { UpdateModelController } from "./controllers/config/update.model.controller";
import { UpdateTavilyKeyController } from "./controllers/config/update.tavily.key.controller";
import { DialogController } from "./controllers/dialog.controller";
import { EventController } from "./controllers/event.controller";
import { InitController } from "./controllers/init.controller";
import { CreateSessionController } from "./controllers/session/create.session.controller";
import { DeleteSessionController } from "./controllers/session/delete.session.controller";
import { GetAvailableSkillsController } from "./controllers/session/get.available.skills.controller";
import { GetSessionHistoryController } from "./controllers/session/get.session.history.controller";
import { GetSessionListController } from "./controllers/session/get.session.list.controller";
import { GetWorkspaceSessionsController } from "./controllers/session/get.workspace.sessions.controller";
import { RenameSessionController } from "./controllers/session/rename.session.controller";
import { ResolveToolApprovalController } from "./controllers/session/resolve.tool.approval.controller";
import { SendMessageController } from "./controllers/session/send.messgae.controller";
import { StopSessionStreamController } from "./controllers/session/stop.session.stream.controller";
import { CreateWorkspaceController } from "./controllers/workspace/create.workspace.controller";
import { DeleteWorkspaceController } from "./controllers/workspace/delete.workspace.controller";
import { GetWorkspaceFilesController } from "./controllers/workspace/get.workspace.files.controller";
import { GetWorkspaceInfoController } from "./controllers/workspace/get.workspace.info.controller";
import { GetWorkspaceListController } from "./controllers/workspace/get.workspace.list.controller";
import { GetWorkspaceSettingsController } from "./controllers/workspace/get.workspace.settings.controller";
import { RenameWorkspaceController } from "./controllers/workspace/rename.workspace.controller";
import { UpdateWorkspaceSettingsController } from "./controllers/workspace/update.workspace.settings.controller";
import { AgentService } from "./service/agent.service";
import { AutomationSchedulerService } from "./service/automation-scheduler.service";
import { registerAutomationToolService } from "./service/automation-tool.service";
import { AutomationService } from "./service/automation.service";
import { ConfigService } from "./service/config.service";
import { AutomationRunDao } from "./service/dao/automation-run.dao.service";
import { AutomationTriggerDao } from "./service/dao/automation-trigger.dao.service";
import { AutomationDao } from "./service/dao/automation.dao.service";
import { ModelDao } from "./service/dao/model.dao.service";
import { SessionMessageDao } from "./service/dao/session-message.dao.service";
import { SessionDao } from "./service/dao/session.dao.service";
import { TavilyDao } from "./service/dao/tavily.dao.service";
import { WorkspaceDao } from "./service/dao/workspace.dao.service";
import { DbService } from "./service/db.service";
import { EventService } from "./service/event.service";
import { SessionService } from "./service/session.service";
import { SkillService } from "./service/skill.service";
import { SystemService } from "./service/system.service";
import { TavilyService } from "./service/tavily.service";
import { TodoService } from "./service/todo.service";
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
    SkillService,
    AgentService,
    ConfigService,
    WorkspaceDao,
    SessionDao,
    SessionMessageDao,
    ModelDao,
    TavilyDao,
    TavilyService,
    TodoService,
    EventService,
    AutomationDao,
    AutomationTriggerDao,
    AutomationRunDao,
    AutomationSchedulerService,
    AutomationService,
  ],
  controllers: [
    InitController,
    DialogController,
    GetAutomationListController,
    GetAutomationController,
    CreateAutomationController,
    UpdateAutomationController,
    DeleteAutomationController,
    GetWorkspaceListController,
    CreateWorkspaceController,
    DeleteWorkspaceController,
    GetWorkspaceInfoController,
    GetWorkspaceFilesController,
    GetWorkspaceSettingsController,
    RenameWorkspaceController,
    UpdateWorkspaceSettingsController,
    CreateSessionController,
    SendMessageController,
    GetSessionListController,
    GetWorkspaceSessionsController,
    GetSessionHistoryController,
    GetAvailableSkillsController,
    RenameSessionController,
    ResolveToolApprovalController,
    DeleteSessionController,
    StopSessionStreamController,
    EventController,
    GetModelListController,
    AddModelController,
    UpdateModelController,
    DeleteModelController,
    SetDefaultModelController,
    GetTavilyKeyListController,
    AddTavilyKeyController,
    UpdateTavilyKeyController,
    DeleteTavilyKeyController,
  ],
})
export class AppModule {
  private initSucceeded = false;

  constructor(
    private windowFactoryResolver: WindowFactoryResolver,
    private automationService: AutomationService,
    private initController: InitController,
    private dialogController: DialogController,
    private getAutomationListController: GetAutomationListController,
    private getAutomationController: GetAutomationController,
    private createAutomationController: CreateAutomationController,
    private updateAutomationController: UpdateAutomationController,
    private deleteAutomationController: DeleteAutomationController,
    private getWorkspaceListController: GetWorkspaceListController,
    private createWorkspaceController: CreateWorkspaceController,
    private deleteWorkspaceController: DeleteWorkspaceController,
    private getWorkspaceInfoController: GetWorkspaceInfoController,
    private getWorkspaceFilesController: GetWorkspaceFilesController,
    private renameWorkspaceController: RenameWorkspaceController,
    private getWorkspaceSettingsController: GetWorkspaceSettingsController,
    private updateWorkspaceSettingsController: UpdateWorkspaceSettingsController,
    private createSessionController: CreateSessionController,
    private sendMessageController: SendMessageController,
    private getSessionListController: GetSessionListController,
    private getWorkspaceSessionsController: GetWorkspaceSessionsController,
    private getSessionHistoryController: GetSessionHistoryController,
    private getAvailableSkillsController: GetAvailableSkillsController,
    private renameSessionController: RenameSessionController,
    private resolveToolApprovalController: ResolveToolApprovalController,
    private deleteSessionController: DeleteSessionController,
    private stopSessionStreamController: StopSessionStreamController,
    private eventController: EventController,
    private getModelListController: GetModelListController,
    private addModelController: AddModelController,
    private updateModelController: UpdateModelController,
    private deleteModelController: DeleteModelController,
    private setDefaultModelController: SetDefaultModelController,
    private getTavilyKeyListController: GetTavilyKeyListController,
    private addTavilyKeyController: AddTavilyKeyController,
    private updateTavilyKeyController: UpdateTavilyKeyController,
    private deleteTavilyKeyController: DeleteTavilyKeyController,
  ) {
    registerAutomationToolService(this.automationService);
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  async onReady() {
    await this.bootstrapApplication();
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
  async onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      if (!this.initSucceeded) {
        await this.bootstrapApplication();
        return;
      }
      this.createWindow();
    }
  }

  private async bootstrapApplication() {
    if (this.initSucceeded) {
      return true;
    }

    try {
      await this.initController.init();
      this.initSucceeded = true;
      this.createWindow();
      return true;
    } catch (error) {
      console.error("数据库迁移失败，应用启动已中止。", error);
      electronDialog.showErrorBox(
        "数据库升级失败",
        "本地数据库升级失败，应用未继续启动。请查看控制台日志后重试。",
      );
      return false;
    }
  }
}
