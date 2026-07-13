// import { join } from "node:path";
import { On, WindowFactoryResolver, Module } from "@willow/poetry";
import { app } from "electron";
import started from "electron-squirrel-startup";
import { EventController } from "./controllers/event.controller";
import { EventService } from "./service/event.service";
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
  providers: [EventService],
  controllers: [EventController],
})
export class AppModule {
  private initSucceeded = false;

  constructor(
    private windowFactoryResolver: WindowFactoryResolver,
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

    this.initSucceeded = true;
    this.createWindow();
    return true;
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
}
