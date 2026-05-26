import { join } from "node:path";
import { On, WindowFactoryResolver, Module } from "@willow/poetry";
import { app, dialog as electronDialog } from "electron";
import started from "electron-squirrel-startup";
import { AiAppBoundsController } from "./controllers/ai-app/ai.app.bounds.controller";
import { AiAppCloseController } from "./controllers/ai-app/ai.app.close.controller";
import { AiAppLoadController } from "./controllers/ai-app/ai.app.load.controller";
import { CreateAutomationController } from "./controllers/automation/create.automation.controller";
import { DeleteAutomationController } from "./controllers/automation/delete.automation.controller";
import { GetAutomationController } from "./controllers/automation/get.automation.controller";
import { GetAutomationListController } from "./controllers/automation/get.automation.list.controller";
import { RunAutomationNowController } from "./controllers/automation/run.automation.now.controller";
import { UpdateAutomationController } from "./controllers/automation/update.automation.controller";
import { AddTavilyKeyController } from "./controllers/config/add.tavily.key.controller";
import { CheckUpdateController } from "./controllers/config/check.update.controller";
import { DeleteTavilyKeyController } from "./controllers/config/delete.tavily.key.controller";
import { GetModelListController } from "./controllers/config/get.model.list.controller";
import { GetTavilyKeyListController } from "./controllers/config/get.tavily.key.list.controller";
import { InstallUpdateController } from "./controllers/config/install.update.controller";
import { SetDeepSeekApiKeyController } from "./controllers/config/set.deepseek.api.key.controller";
import { SetDefaultModelController } from "./controllers/config/set.default.model.controller";
import { StartDownloadController } from "./controllers/config/start.download.controller";
import { UpdateTavilyKeyController } from "./controllers/config/update.tavily.key.controller";
import { DialogController } from "./controllers/dialog.controller";
import { EventController } from "./controllers/event.controller";
import { GetFloatingBallConfigController } from "./controllers/floating-ball/get.floating.ball.config.controller";
import { MoveFloatingBallWindowController } from "./controllers/floating-ball/move.floating.ball.window.controller";
import { ResizeFloatingBallWindowController } from "./controllers/floating-ball/resize.floating.ball.window.controller";
import { SetFloatingBallEnabledController } from "./controllers/floating-ball/set.floating.ball.enabled.controller";
import { SetFloatingBallPositionController } from "./controllers/floating-ball/set.floating.ball.position.controller";
import { ShowFloatingBallMenuController } from "./controllers/floating-ball/show.floating.ball.menu.controller";
import { ShowMainWindowController } from "./controllers/floating-ball/show.main.window.controller";
import { InitController } from "./controllers/init.controller";
import { AddMcpServerController } from "./controllers/mcp/add.mcp.server.controller";
import { DeleteMcpServerController } from "./controllers/mcp/delete.mcp.server.controller";
import { GetMcpServersController } from "./controllers/mcp/get.mcp.servers.controller";
import { ToggleMcpServerController } from "./controllers/mcp/toggle.mcp.server.controller";
import { UpdateMcpServerController } from "./controllers/mcp/update.mcp.server.controller";
import { CreateSessionController } from "./controllers/session/create.session.controller";
import { DeleteSessionController } from "./controllers/session/delete.session.controller";
import { GetAvailableSkillsController } from "./controllers/session/get.available.skills.controller";
import { GetConversationSessionController } from "./controllers/session/get.conversation.session.controller";
import { GetSessionController } from "./controllers/session/get.session.controller";
import { GetSessionHistoryController } from "./controllers/session/get.session.history.controller";
import { GetSessionListController } from "./controllers/session/get.session.list.controller";
import { GetWorkspaceSessionsController } from "./controllers/session/get.workspace.sessions.controller";
import { RenameSessionController } from "./controllers/session/rename.session.controller";
import { ResolveToolApprovalController } from "./controllers/session/resolve.tool.approval.controller";
import { SendMessageController } from "./controllers/session/send.messgae.controller";
import { StopSessionStreamController } from "./controllers/session/stop.session.stream.controller";
import { CreateWorkspaceController } from "./controllers/workspace/create.workspace.controller";
import { DeleteWorkspaceController } from "./controllers/workspace/delete.workspace.controller";
import { GetWorkspaceAgentsController } from "./controllers/workspace/get.workspace.agents.controller";
import { GetWorkspaceFilesController } from "./controllers/workspace/get.workspace.files.controller";
import { GetWorkspaceInfoController } from "./controllers/workspace/get.workspace.info.controller";
import { GetWorkspaceListController } from "./controllers/workspace/get.workspace.list.controller";
import { GetWorkspaceSettingsController } from "./controllers/workspace/get.workspace.settings.controller";
import { RenameWorkspaceController } from "./controllers/workspace/rename.workspace.controller";
import { UpdateWorkspaceSettingsController } from "./controllers/workspace/update.workspace.settings.controller";
import { AgentService } from "./service/agent.service";
import { AiAppViewService } from "./service/ai-app-view.service";
import { AutomationSchedulerService } from "./service/automation-scheduler.service";
import { registerAutomationToolService } from "./service/automation-tool.service";
import { AutomationService } from "./service/automation.service";
import { ConfigService } from "./service/config.service";
import { ContextCompressionService } from "./service/context-compression.service";
import { ConversationContextCompressionService } from "./service/conversation-context-compression.service";
import { AutomationRunDao } from "./service/dao/automation-run.dao.service";
import { AutomationTriggerDao } from "./service/dao/automation-trigger.dao.service";
import { AutomationDao } from "./service/dao/automation.dao.service";
import { ConversationContextStateDao } from "./service/dao/conversation-context-state.dao.service";
import { ModelDao } from "./service/dao/model.dao.service";
import { SessionContextSummaryDao } from "./service/dao/session-context-summary.dao.service";
import { SessionMessageDao } from "./service/dao/session-message.dao.service";
import { SessionDao } from "./service/dao/session.dao.service";
import { TavilyDao } from "./service/dao/tavily.dao.service";
import { WorkspaceDao } from "./service/dao/workspace.dao.service";
import { DbService } from "./service/db.service";
import { EventService } from "./service/event.service";
import { FloatingBallService } from "./service/floating-ball.service";
import { McpServerService } from "./service/mcp-server.service";
import { SessionService } from "./service/session.service";
import { SkillService } from "./service/skill.service";
import { SystemService } from "./service/system.service";
import { TavilyService } from "./service/tavily.service";
import { TodoService } from "./service/todo.service";
import { UpdateService } from "./service/update.service";
import { WorkspaceAgentService } from "./service/workspace-agent.service";
import { WorkspaceService } from "./service/workspace.service";
import { FloatingBallWindow } from "./window/floating-ball.window";
import { MainWindow } from "./window/main.window";

if (started) {
  app.quit();
}

if (!app.isPackaged && process.platform === "darwin") {
  app.dock.setIcon(join(__dirname, "../../assets/icons/icon.png"));
}
@Module({
  imports: [],
  windows: [MainWindow, FloatingBallWindow],
  providers: [
    DbService,
    WorkspaceService,
    WorkspaceAgentService,
    SystemService,
    SessionService,
    SkillService,
    AgentService,
    ConfigService,
    ContextCompressionService,
    ConversationContextCompressionService,
    WorkspaceDao,
    SessionDao,
    SessionMessageDao,
    SessionContextSummaryDao,
    ConversationContextStateDao,
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
    AiAppViewService,
    FloatingBallService,
    UpdateService,
    McpServerService,
  ],
  controllers: [
    InitController,
    DialogController,
    GetAutomationListController,
    GetAutomationController,
    CreateAutomationController,
    UpdateAutomationController,
    RunAutomationNowController,
    DeleteAutomationController,
    GetWorkspaceListController,
    CreateWorkspaceController,
    DeleteWorkspaceController,
    GetWorkspaceInfoController,
    GetWorkspaceFilesController,
    GetWorkspaceAgentsController,
    GetWorkspaceSettingsController,
    RenameWorkspaceController,
    UpdateWorkspaceSettingsController,
    CreateSessionController,
    SendMessageController,
    GetSessionListController,
    GetSessionController,
    GetWorkspaceSessionsController,
    GetSessionHistoryController,
    GetConversationSessionController,
    GetAvailableSkillsController,
    RenameSessionController,
    ResolveToolApprovalController,
    DeleteSessionController,
    StopSessionStreamController,
    EventController,
    GetModelListController,
    SetDeepSeekApiKeyController,
    SetDefaultModelController,
    GetTavilyKeyListController,
    AddTavilyKeyController,
    UpdateTavilyKeyController,
    DeleteTavilyKeyController,
    AiAppLoadController,
    AiAppBoundsController,
    AiAppCloseController,
    GetFloatingBallConfigController,
    SetFloatingBallEnabledController,
    SetFloatingBallPositionController,
    MoveFloatingBallWindowController,
    ResizeFloatingBallWindowController,
    ShowMainWindowController,
    ShowFloatingBallMenuController,
    CheckUpdateController,
    StartDownloadController,
    InstallUpdateController,
    GetMcpServersController,
    AddMcpServerController,
    UpdateMcpServerController,
    DeleteMcpServerController,
    ToggleMcpServerController,
  ],
})
export class AppModule {
  private initSucceeded = false;

  constructor(
    private windowFactoryResolver: WindowFactoryResolver,
    private skillService: SkillService,
    private automationService: AutomationService,
    private initController: InitController,
    private dialogController: DialogController,
    private getAutomationListController: GetAutomationListController,
    private getAutomationController: GetAutomationController,
    private createAutomationController: CreateAutomationController,
    private updateAutomationController: UpdateAutomationController,
    private runAutomationNowController: RunAutomationNowController,
    private deleteAutomationController: DeleteAutomationController,
    private getWorkspaceListController: GetWorkspaceListController,
    private createWorkspaceController: CreateWorkspaceController,
    private deleteWorkspaceController: DeleteWorkspaceController,
    private getWorkspaceInfoController: GetWorkspaceInfoController,
    private getWorkspaceFilesController: GetWorkspaceFilesController,
    private getWorkspaceAgentsController: GetWorkspaceAgentsController,
    private renameWorkspaceController: RenameWorkspaceController,
    private getWorkspaceSettingsController: GetWorkspaceSettingsController,
    private updateWorkspaceSettingsController: UpdateWorkspaceSettingsController,
    private createSessionController: CreateSessionController,
    private sendMessageController: SendMessageController,
    private getSessionListController: GetSessionListController,
    private getSessionController: GetSessionController,
    private getWorkspaceSessionsController: GetWorkspaceSessionsController,
    private getSessionHistoryController: GetSessionHistoryController,
    private getConversationSessionController: GetConversationSessionController,
    private getAvailableSkillsController: GetAvailableSkillsController,
    private renameSessionController: RenameSessionController,
    private resolveToolApprovalController: ResolveToolApprovalController,
    private deleteSessionController: DeleteSessionController,
    private stopSessionStreamController: StopSessionStreamController,
    private eventController: EventController,
    private getModelListController: GetModelListController,
    private setDeepSeekApiKeyController: SetDeepSeekApiKeyController,
    private setDefaultModelController: SetDefaultModelController,
    private getTavilyKeyListController: GetTavilyKeyListController,
    private addTavilyKeyController: AddTavilyKeyController,
    private updateTavilyKeyController: UpdateTavilyKeyController,
    private deleteTavilyKeyController: DeleteTavilyKeyController,
    private aiAppLoadController: AiAppLoadController,
    private aiAppBoundsController: AiAppBoundsController,
    private aiAppCloseController: AiAppCloseController,
    private getFloatingBallConfigController: GetFloatingBallConfigController,
    private setFloatingBallEnabledController: SetFloatingBallEnabledController,
    private setFloatingBallPositionController: SetFloatingBallPositionController,
    private moveFloatingBallWindowController: MoveFloatingBallWindowController,
    private resizeFloatingBallWindowController: ResizeFloatingBallWindowController,
    private showMainWindowController: ShowMainWindowController,
    private showFloatingBallMenuController: ShowFloatingBallMenuController,
    private floatingBallService: FloatingBallService,
    private checkUpdateController: CheckUpdateController,
    private startDownloadController: StartDownloadController,
    private installUpdateController: InstallUpdateController,
    private mcpServerService: McpServerService,
    private getMcpServersController: GetMcpServersController,
    private addMcpServersController: AddMcpServerController,
    private updateMcpServersController: UpdateMcpServerController,
    private deleteMcpServersController: DeleteMcpServerController,
    private toggleMcpServersController: ToggleMcpServerController,
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
    this.mcpServerService.shutdown();
  }

  @On("window-all-closed")
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  @On("activate")
  async onActivate() {
    if (!this.initSucceeded) {
      await this.bootstrapApplication();
      return;
    }

    this.showMainWindow();
  }

  private async bootstrapApplication() {
    if (this.initSucceeded) {
      return true;
    }

    try {
      this.skillService.ensureBuiltinSkills();
      await this.initController.init();
      await this.floatingBallService.init();
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

  private showMainWindow() {
    const mainWindow = this.windowFactoryResolver.resolveWindowFactory(MainWindow);

    if (!mainWindow.win || mainWindow.win.isDestroyed()) {
      this.createWindow();
      return;
    }

    if (mainWindow.win.isMinimized()) {
      mainWindow.win.restore();
    }

    mainWindow.win.show();
    mainWindow.win.focus();
  }
}
