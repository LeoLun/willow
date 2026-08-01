import { join } from "node:path";
import {
  Tray as PoetryTray,
  TrayInstance,
  WindowFactoryResolver,
  type OnInit,
} from "@willow/poetry";
import { app, Menu, Tray, type MenuItemConstructorOptions } from "electron";
import { MainWindow } from "./window/main.window";

const APPLICATION_NAME = "Willow";
const MENU_BAR_ICON_PATH = join(__dirname, "../../assets/icons/trayTemplate.png");

export function createMenuBarTemplate(
  showMainWindow: () => void,
  quitApplication: () => void,
): MenuItemConstructorOptions[] {
  return [
    {
      label: "显示主窗口",
      click: showMainWindow,
    },
    {
      label: "退出",
      click: quitApplication,
    },
  ];
}

@PoetryTray({ image: MENU_BAR_ICON_PATH, templateImage: true })
export class MacMenuBar implements OnInit {
  @TrayInstance()
  public tray!: Tray;

  constructor(private readonly windowFactoryResolver: WindowFactoryResolver) {}

  onInit() {
    this.tray.setToolTip(APPLICATION_NAME);
    this.tray.setContextMenu(
      Menu.buildFromTemplate(
        createMenuBarTemplate(
          () => this.showMainWindow(),
          () => app.quit(),
        ),
      ),
    );
  }

  private showMainWindow() {
    const mainWindow = this.windowFactoryResolver.resolveWindowFactory(MainWindow);
    if (!mainWindow.win || mainWindow.win.isDestroyed()) return;
    if (mainWindow.win.isMinimized()) mainWindow.win.restore();
    mainWindow.win.show();
    mainWindow.win.focus();
  }
}
