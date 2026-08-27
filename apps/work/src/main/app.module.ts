import { join } from "node:path";
import {
  Module,
  On,
  TrayFactoryResolver,
  WindowFactoryResolver,
} from "@willow/poetry";
import { app, powerMonitor, screen } from "electron";
import started from "electron-squirrel-startup";
import { CheckAppUpdateController } from "./controllers/app-update/check.app-update.controller";
import { ConfirmUpdateBootController } from "./controllers/app-update/confirm-boot.app-update.controller";
import { DownloadAppUpdateController } from "./controllers/app-update/download.app-update.controller";
import { GetAppUpdateStateController } from "./controllers/app-update/get-state.app-update.controller";
import { OpenManualUpdateController } from "./controllers/app-update/open-manual.app-update.controller";
import { RestartToUpdateController } from "./controllers/app-update/restart.app-update.controller";
import { GetAppInfoController } from "./controllers/app/get-info.app.controller";
import { GetAutoLaunchController } from "./controllers/auto-launch/get.auto-launch.controller";
import { SetAutoLaunchController } from "./controllers/auto-launch/set.auto-launch.controller";
import { CreateAutomationController } from "./controllers/automation/create.automation.controller";
import { DeleteAutomationController } from "./controllers/automation/delete.automation.controller";
import { GetAutomationListController } from "./controllers/automation/get-list.automation.controller";
import { GetAutomationController } from "./controllers/automation/get.automation.controller";
import { ListAutomationRunsController } from "./controllers/automation/list-runs.automation.controller";
import { RunAutomationNowController } from "./controllers/automation/run-now.automation.controller";
import { UpdateAutomationController } from "./controllers/automation/update.automation.controller";
import { GetBoardPanelController } from "./controllers/board/get.board.controller";
import { SetBoardEditModeController } from "./controllers/board/set-edit-mode.board.controller";
import { DeleteCredentialController } from "./controllers/credential/delete.credential.controller";
import { GetConfiguredProvidersController } from "./controllers/credential/get-configured.credential.controller";
import { GetCredentialController } from "./controllers/credential/get.credential.controller";
import { SetCredentialController } from "./controllers/credential/set.credential.controller";
import { EventController } from "./controllers/event.controller";
import { ListWorkspaceDirectoryController } from "./controllers/file-search/list-directory.file-search.controller";
import { OpenWorkspaceFileController } from "./controllers/file-search/open-file.file-search.controller";
import { ReadWorkspaceFileController } from "./controllers/file-search/read-file.file-search.controller";
import { RevealWorkspaceEntryController } from "./controllers/file-search/reveal-entry.file-search.controller";
import { SearchFilesController } from "./controllers/file-search/search.file-search.controller";
import { SubscribeWorkspaceFilesController } from "./controllers/file-search/subscribe.file-search.controller";
import { UnsubscribeWorkspaceFilesController } from "./controllers/file-search/unsubscribe.file-search.controller";
import { CommitGitChangesController } from "./controllers/git-review/commit.git-review.controller";
import { GetGitReviewDiffController } from "./controllers/git-review/get-diff.git-review.controller";
import { GetGitReviewStatusController } from "./controllers/git-review/get-status.git-review.controller";
import { StageGitChangesController } from "./controllers/git-review/stage.git-review.controller";
import { UnstageGitChangesController } from "./controllers/git-review/unstage.git-review.controller";
import { InspectLocalFilesController } from "./controllers/local-file/inspect.local-file.controller";
import { PersistClipboardImagesController } from "./controllers/local-file/persist.clipboard-image.controller";
import { SelectLocalFilesController } from "./controllers/local-file/select.local-file.controller";
import { GetMessageListController } from "./controllers/message/get-list.message.controller";
import { ResolveToolApprovalController } from "./controllers/message/resolve-tool-approval.message.controller";
import { ResolveUserQuestionController } from "./controllers/message/resolve-user-question.message.controller";
import { SendMessageController } from "./controllers/message/send.message.controller";
import { SetPermissionModeController } from "./controllers/message/set-permission-mode.message.controller";
import { StopMessageController } from "./controllers/message/stop.message.controller";
import { ReadPlanFileController } from "./controllers/plan-file/read.plan-file.controller";
import { GetProviderCatalogController } from "./controllers/provider/get-catalog.provider.controller";
import { CreateSessionController } from "./controllers/session/create.session.controller";
import { GetSessionListController } from "./controllers/session/get-list.session.controller";
import { GetBuiltinSkillListController } from "./controllers/skill/get-builtin-list.skill.controller";
import { GetSkillListController } from "./controllers/skill/get-list.skill.controller";
import { SetBuiltinSkillEnabledController } from "./controllers/skill/set-builtin-enabled.skill.controller";
import { GetStatisticsController } from "./controllers/statistics/get.statistics.controller";
import { DeleteTavilyApiKeyController } from "./controllers/tavily/delete-api-key.tavily.controller";
import { GetTavilySettingsController } from "./controllers/tavily/get-settings.tavily.controller";
import { SetTavilyApiKeyController } from "./controllers/tavily/set-api-key.tavily.controller";
import { SetThemeController } from "./controllers/theme/set.theme.controller";
import { GetUserConfigController } from "./controllers/user-config/get.user-config.controller";
import { SetUserConfigController } from "./controllers/user-config/set.user-config.controller";
import { CreateWorkspaceController } from "./controllers/workspace/create.workspace.controller";
import { DeleteWorkspaceController } from "./controllers/workspace/delete.workspace.controller";
import { GetWorkspaceDetailController } from "./controllers/workspace/get-detail.workspace.controller";
import { GetWorkspaceListController } from "./controllers/workspace/get-list.workspace.controller";
import { OpenWorkspaceDirectoryController } from "./controllers/workspace/open-directory.workspace.controller";
import { RenameWorkspaceController } from "./controllers/workspace/rename.workspace.controller";
import { SelectWorkspaceDirectoryController } from "./controllers/workspace/select-directory.workspace.controller";
import { SetWorkspacePinnedController } from "./controllers/workspace/set-pinned.workspace.controller";
import { MacMenuBar } from "./menu-bar";
import { AgentService } from "./service/agent.service";
import { AiToolApprovalService } from "./service/ai-tool-approval.service";
import { AppUpdateService } from "./service/app-update.service";
import { AutoLaunchService } from "./service/auto-launch.service";
import { AutomationSchedulerService } from "./service/automation-scheduler.service";
import { AutomationService } from "./service/automation.service";
import { BoardPanelService } from "./service/board-panel.service";
import { BuiltinSkillService } from "./service/builtin-skill.service";
import { CredentialService } from "./service/credential.service";
import { AutomationRunDao } from "./service/dao/automation-run.dao.server";
import { AutomationTriggerDao } from "./service/dao/automation-trigger.dao.server";
import { AutomationDao } from "./service/dao/automation.dao.server";
import { BuiltinSkillSettingDao } from "./service/dao/builtin-skill-setting.dao.server";
import { CredentialDao } from "./service/dao/credential.dao.server";
import { SessionDao } from "./service/dao/session.dao.server";
import { StatisticsDao } from "./service/dao/statistics.dao.server";
import { UserConfigDao } from "./service/dao/user-config.dao.server";
import { WorkspaceDao } from "./service/dao/workspace.dao.server";
import { DbService } from "./service/db.service";
import { EventService } from "./service/event.service";
import { FileSearchService } from "./service/file-search.service";
import { GitReviewService } from "./service/git-review.service";
import { LocalFileService } from "./service/local-file.service";
import { MessageService } from "./service/message.service";
import { PermissionModeService } from "./service/permission-mode.service";
import { PlanFileService } from "./service/plan-file.service";
import { ProviderCatalogService } from "./service/provider-catalog.service";
import { SessionManagerFactory } from "./service/session-manager.factory";
import { SessionService } from "./service/session.service";
import { SkillService } from "./service/skill.service";
import { StatisticsService } from "./service/statistics.service";
import { TavilyService } from "./service/tavily.service";
import { TitleService } from "./service/title.service";
import { ToolApprovalService } from "./service/tool-approval.service";
import { TurnArtifactService } from "./service/turn-artifact.service";
import { UserConfigService } from "./service/user-config.service";
import { UserQuestionService } from "./service/user-question.service";
import { WorkspaceFileWatcherService } from "./service/workspace-file-watcher.service";
import { WorkspaceService } from "./service/workspace.service";
import { configureMainWindowBounds, MainWindow } from "./window/main.window";

if (started) {
  app.quit();
}

if (!app.isPackaged && process.platform === "darwin" && app.dock) {
  app.dock.setIcon(join(__dirname, "../../assets/icons/icon-dev.png"));
}

@Module({
  imports: [],
  windows: [MainWindow],
  trays: process.platform === "darwin" ? [MacMenuBar] : [],
  providers: [
    DbService,
    AutoLaunchService,
    BoardPanelService,
    AppUpdateService,
    WorkspaceDao,
    SessionDao,
    StatisticsDao,
    CredentialDao,
    UserConfigDao,
    BuiltinSkillSettingDao,
    AutomationDao,
    AutomationTriggerDao,
    AutomationRunDao,
    AutomationSchedulerService,
    AutomationService,
    SessionManagerFactory,
    StatisticsService,
    TavilyService,
    AgentService,
    AiToolApprovalService,
    SessionService,
    BuiltinSkillService,
    SkillService,
    TitleService,
    CredentialService,
    EventService,
    FileSearchService,
    GitReviewService,
    WorkspaceFileWatcherService,
    LocalFileService,
    MessageService,
    PermissionModeService,
    PlanFileService,
    TurnArtifactService,
    ToolApprovalService,
    UserQuestionService,
    ProviderCatalogService,
    UserConfigService,
    WorkspaceService,
  ],
  controllers: [
    EventController,
    GetAppUpdateStateController,
    CheckAppUpdateController,
    DownloadAppUpdateController,
    RestartToUpdateController,
    OpenManualUpdateController,
    ConfirmUpdateBootController,
    GetAutomationListController,
    GetAutomationController,
    CreateAutomationController,
    UpdateAutomationController,
    DeleteAutomationController,
    RunAutomationNowController,
    ListAutomationRunsController,
    GetBoardPanelController,
    SetBoardEditModeController,
    ListWorkspaceDirectoryController,
    OpenWorkspaceFileController,
    ReadWorkspaceFileController,
    RevealWorkspaceEntryController,
    SearchFilesController,
    SubscribeWorkspaceFilesController,
    UnsubscribeWorkspaceFilesController,
    GetGitReviewStatusController,
    GetGitReviewDiffController,
    StageGitChangesController,
    UnstageGitChangesController,
    CommitGitChangesController,
    InspectLocalFilesController,
    PersistClipboardImagesController,
    SelectLocalFilesController,
    ReadPlanFileController,
    GetAppInfoController,
    SetThemeController,
    GetAutoLaunchController,
    SetAutoLaunchController,
    GetProviderCatalogController,
    GetConfiguredProvidersController,
    GetCredentialController,
    SetCredentialController,
    DeleteCredentialController,
    GetUserConfigController,
    SetUserConfigController,
    CreateSessionController,
    GetSessionListController,
    GetBuiltinSkillListController,
    GetSkillListController,
    SetBuiltinSkillEnabledController,
    GetStatisticsController,
    GetTavilySettingsController,
    SetTavilyApiKeyController,
    DeleteTavilyApiKeyController,
    SendMessageController,
    SetPermissionModeController,
    StopMessageController,
    GetMessageListController,
    ResolveToolApprovalController,
    ResolveUserQuestionController,
    GetWorkspaceListController,
    CreateWorkspaceController,
    SelectWorkspaceDirectoryController,
    SetWorkspacePinnedController,
    RenameWorkspaceController,
    GetWorkspaceDetailController,
    OpenWorkspaceDirectoryController,
    DeleteWorkspaceController,
  ],
})
export class AppModule {
  private initSucceeded = false;
  private resumeListenerRegistered = false;

  constructor(
    private windowFactoryResolver: WindowFactoryResolver,
    private trayFactoryResolver: TrayFactoryResolver,
    private dbService: DbService,
    private eventController: EventController,
    private eventService: EventService,
    private workspaceFileWatcherService: WorkspaceFileWatcherService,
    private automationService: AutomationService,
    private agentService: AgentService,
  ) {}

  private readonly onSystemResume = () => {
    void this.automationService.onSystemResume().catch((error) => {
      console.error("Failed to check automations after system resume:", error);
    });
  };

  createWindow() {
    configureMainWindowBounds(screen.getPrimaryDisplay().workArea);
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  async onReady() {
    console.log("onReady");
    await this.bootstrapApplication();
    this.createMenuBar();
  }

  @On("before-quit")
  async onBeforeQuit() {
    await this.automationService.shutdown();
    await this.workspaceFileWatcherService.closeAll();
    this.dbService.close();
  }

  @On("window-all-closed")
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  @On("activate")
  async onActivate() {
    console.log("onActivate");
    if (!this.initSucceeded) {
      await this.bootstrapApplication();
      this.createMenuBar();
      return;
    }
    this.showMainWindow();
  }

  private async bootstrapApplication() {
    console.log("bootstrapApplication", this.initSucceeded);
    if (this.initSucceeded) {
      return true;
    }

    try {
      console.log("bootstrapApplication init db");
      this.dbService.init();
      console.log("bootstrapApplication initialize automation");
      await this.automationService.initialize();
      console.log("bootstrapApplication set list automations handler");
      this.agentService.setListAutomationsHandler((workspaceId) =>
        this.automationService.listAutomationsFromAgent(workspaceId),
      );
      console.log("bootstrapApplication set create automation handler");
      this.agentService.setCreateAutomationHandler((workspaceId, input) =>
        this.automationService.createAutomationFromAgent(input, workspaceId),
      );
      console.log("bootstrapApplication set update automation handler");
      this.agentService.setUpdateAutomationHandler((workspaceId, input) =>
        this.automationService.updateAutomationFromAgent(input, workspaceId),
      );
      console.log("bootstrapApplication set delete automation handler");
      this.agentService.setDeleteAutomationHandler((workspaceId, input) =>
        this.automationService.deleteAutomationFromAgent(input, workspaceId),
      );
      console.log("bootstrapApplication set resume listener");
      if (!this.resumeListenerRegistered) {
        powerMonitor.on("resume", this.onSystemResume);
        this.resumeListenerRegistered = true;
      }
      console.log("bootstrapApplication create window");
      this.createWindow();
      console.log("bootstrapApplication set init succeeded");
      this.initSucceeded = true;
      return true;
    } catch (error) {
      console.error("bootstrapApplication error", error);
      this.initSucceeded = false;
      throw error;
    }
  }

  private showMainWindow() {
    const mainWindow =
      this.windowFactoryResolver.resolveWindowFactory(MainWindow);

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

  private createMenuBar() {
    if (process.platform === "darwin") {
      this.trayFactoryResolver.resolveTrayFactory(MacMenuBar);
    }
  }
}
