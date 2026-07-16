// import { join } from "node:path";
import { On, WindowFactoryResolver, Module } from "@willow/poetry";
import { app } from "electron";
import started from "electron-squirrel-startup";
import { GetAppInfoController } from "./controllers/app/get-info.app.controller";
import { DeleteCredentialController } from "./controllers/credential/delete.credential.controller";
import { GetCredentialController } from "./controllers/credential/get.credential.controller";
import { SetCredentialController } from "./controllers/credential/set.credential.controller";
import { EventController } from "./controllers/event.controller";
import { GetProviderCatalogController } from "./controllers/provider/get-catalog.provider.controller";
import { CredentialService } from "./service/credential.service";
import { CredentialDao } from "./service/dao/credential.dao.server";
import { SessionDao } from "./service/dao/session.dao.server";
import { WorkspaceDao } from "./service/dao/workspace.dao.server";
import { DbService } from "./service/db.service";
import { EventService } from "./service/event.service";
import { ProviderCatalogService } from "./service/provider-catalog.service";
import { MainWindow } from "./window/main.window";

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
    CredentialDao,
    CredentialService,
    EventService,
    ProviderCatalogService,
  ],
  controllers: [
    EventController,
    GetAppInfoController,
    GetProviderCatalogController,
    GetCredentialController,
    SetCredentialController,
    DeleteCredentialController,
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
