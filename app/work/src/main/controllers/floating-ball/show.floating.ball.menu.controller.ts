import { FloatingBallService } from "@main/service/floating-ball.service";
import type { ApiResponse } from "@shared/api";
import { SHOW_FLOATING_BALL_MENU } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ShowFloatingBallMenuController extends IPCBaseController<void, void> {
  constructor(private readonly floatingBallService: FloatingBallService) {
    super();
  }

  @IPC(SHOW_FLOATING_BALL_MENU)
  async run(event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<void>> {
    const template: MenuItemConstructorOptions[] = [
      {
        label: "关闭悬浮球",
        click: () => {
          void this.floatingBallService.setEnabled(false);
        },
      },
      {
        label: "退出 Willow",
        click: () => {
          app.quit();
        },
      },
    ];
    const menu = Menu.buildFromTemplate(template);
    const menuWindow = BrowserWindow.fromWebContents(event.sender);
    menu.popup(menuWindow ? { window: menuWindow } : {});
    return this.buildResponse(undefined);
  }

  checkParams(_request: void): Error | undefined {
    return undefined;
  }
}
