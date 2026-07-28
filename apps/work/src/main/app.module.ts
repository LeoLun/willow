// import { join } from "node:path";
import { On, WindowFactoryResolver, Module } from "@willow/poetry";
import { app, screen } from "electron";
import started from "electron-squirrel-startup";
import { GetAppInfoController } from "./controllers/app/get-info.app.controller";
import { DeleteCredentialController } from "./controllers/credential/delete.credential.controller";
import { GetConfiguredProvidersController } from "./controllers/credential/get-configured.credential.controller";
import { GetCredentialController } from "./controllers/credential/get.credential.controller";
import { SetCredentialController } from "./controllers/credential/set.credential.controller";
import { EventController } from "./controllers/event.controller";
import { SearchFilesController } from "./controllers/file-search/search.file-search.controller";
import { GetMessageListController } from "./controllers/message/get-list.message.controller";
import { ResolveToolApprovalController } from "./controllers/message/resolve-tool-approval.message.controller";
import { SendMessageController } from "./controllers/message/send.message.controller";
import { StopMessageController } from "./controllers/message/stop.message.controller";
import { GetProviderCatalogController } from "./controllers/provider/get-catalog.provider.controller";
import { CreateSessionController } from "./controllers/session/create.session.controller";
import { GetSessionListController } from "./controllers/session/get-list.session.controller";
import { GetSkillListController } from "./controllers/skill/get-list.skill.controller";
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
import { RenameWorkspaceController } from "./controllers/workspace/rename.workspace.controller";
import { SelectWorkspaceDirectoryController } from "./controllers/workspace/select-directory.workspace.controller";
import { SetWorkspacePinnedController } from "./controllers/workspace/set-pinned.workspace.controller";
import { AgentService } from "./service/agent.service";
import { AiToolApprovalService } from "./service/ai-tool-approval.service";
import { CredentialService } from "./service/credential.service";
import { CredentialDao } from "./service/dao/credential.dao.server";
import { SessionDao } from "./service/dao/session.dao.server";
import { StatisticsDao } from "./service/dao/statistics.dao.server";
import { UserConfigDao } from "./service/dao/user-config.dao.server";
import { WorkspaceDao } from "./service/dao/workspace.dao.server";
import { DbService } from "./service/db.service";
import { EventService } from "./service/event.service";
import { FileSearchService } from "./service/file-search.service";
import { MessageService } from "./service/message.service";
import { ProviderCatalogService } from "./service/provider-catalog.service";
import { SessionManagerFactory } from "./service/session-manager.factory";
import { SessionService } from "./service/session.service";
import { SkillService } from "./service/skill.service";
import { StatisticsService } from "./service/statistics.service";
import { TavilyService } from "./service/tavily.service";
import { TitleService } from "./service/title.service";
import { ToolApprovalService } from "./service/tool-approval.service";
import { UserConfigService } from "./service/user-config.service";
import { WorkspaceService } from "./service/workspace.service";
import { configureMainWindowBounds, MainWindow } from "./window/main.window";

if (started) {
  app.quit();
}

// if (!app.isPackaged && process.platform === "darwin" && app.dock) {
//   app.dock.setIcon(join(__dirname, "../../assets/icons/icon.png"));
// }
@Module({
  imports: [],
  windows: [MainWindow],
  providers: [
    DbService,
    WorkspaceDao,
    SessionDao,
    StatisticsDao,
    CredentialDao,
    UserConfigDao,
    SessionManagerFactory,
    StatisticsService,
    TavilyService,
    AgentService,
    AiToolApprovalService,
    SessionService,
    SkillService,
    TitleService,
    CredentialService,
    EventService,
    FileSearchService,
    MessageService,
    ToolApprovalService,
    ProviderCatalogService,
    UserConfigService,
    WorkspaceService,
  ],
  controllers: [
    EventController,
    SearchFilesController,
    GetAppInfoController,
    SetThemeController,
    GetProviderCatalogController,
    GetConfiguredProvidersController,
    GetCredentialController,
    SetCredentialController,
    DeleteCredentialController,
    GetUserConfigController,
    SetUserConfigController,
    CreateSessionController,
    GetSessionListController,
    GetSkillListController,
    GetStatisticsController,
    GetTavilySettingsController,
    SetTavilyApiKeyController,
    DeleteTavilyApiKeyController,
    SendMessageController,
    StopMessageController,
    GetMessageListController,
    ResolveToolApprovalController,
    GetWorkspaceListController,
    CreateWorkspaceController,
    SelectWorkspaceDirectoryController,
    SetWorkspacePinnedController,
    RenameWorkspaceController,
    GetWorkspaceDetailController,
    DeleteWorkspaceController,
  ],
})
export class AppModule {
  private initSucceeded = false;

  constructor(
    private windowFactoryResolver: WindowFactoryResolver,
    private dbService: DbService,
    private eventController: EventController,
    private eventService: EventService,
  ) {}

  createWindow() {
    configureMainWindowBounds(screen.getPrimaryDisplay().workArea);
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  async onReady() {
    await this.bootstrapApplication();
  }

  @On("before-quit")
  async onBeforeQuit() {
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
      return;
    }
    this.showMainWindow();
  }

  private async bootstrapApplication() {
    if (this.initSucceeded) {
      return true;
    }

    try {
      this.dbService.init();
      this.createWindow();
      this.initSucceeded = true;
      return true;
    } catch (error) {
      this.initSucceeded = false;
      throw error;
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
