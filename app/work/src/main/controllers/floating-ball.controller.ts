import type {
  ApiResponse,
  GetFloatingBallConfigResponse,
  MoveFloatingBallWindowRequest,
  SetFloatingBallEnabledRequest,
  SetFloatingBallPositionRequest,
} from "@shared/api";
import {
  GET_FLOATING_BALL_CONFIG,
  MOVE_FLOATING_BALL_WINDOW,
  SET_FLOATING_BALL_ENABLED,
  SET_FLOATING_BALL_POSITION,
  SHOW_MAIN_WINDOW,
  SHOW_FLOATING_BALL_MENU,
} from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { app, BrowserWindow, Menu, type MenuItemConstructorOptions } from "electron";
import { FloatingBallService } from "../service/floating-ball.service";

@Injectable()
export class FloatingBallController {
  constructor(private readonly floatingBallService: FloatingBallService) {}

  @IPC(GET_FLOATING_BALL_CONFIG)
  async getFloatingBallConfig(): Promise<ApiResponse<GetFloatingBallConfigResponse>> {
    return {
      code: 0,
      msg: "success",
      data: {
        config: this.floatingBallService.getConfig(),
      },
    };
  }

  @IPC(SET_FLOATING_BALL_ENABLED)
  async setFloatingBallEnabled(
    _event: Electron.IpcMainInvokeEvent,
    request: SetFloatingBallEnabledRequest,
  ): Promise<ApiResponse<void>> {
    await this.floatingBallService.setEnabled(request.enabled);
    return { code: 0, msg: "success" };
  }

  @IPC(SET_FLOATING_BALL_POSITION)
  async setFloatingBallPosition(
    _event: Electron.IpcMainInvokeEvent,
    request: SetFloatingBallPositionRequest,
  ): Promise<ApiResponse<void>> {
    await this.floatingBallService.setPosition(request.x, request.y);
    return { code: 0, msg: "success" };
  }

  @IPC(MOVE_FLOATING_BALL_WINDOW)
  async moveFloatingBallWindow(
    _event: Electron.IpcMainInvokeEvent,
    request: MoveFloatingBallWindowRequest,
  ): Promise<ApiResponse<void>> {
    this.floatingBallService.moveWindow(request.x, request.y);
    return { code: 0, msg: "success" };
  }

  @IPC(SHOW_MAIN_WINDOW)
  async showMainWindow(): Promise<ApiResponse<void>> {
    this.floatingBallService.showMainWindow();
    return { code: 0, msg: "success" };
  }

  @IPC(SHOW_FLOATING_BALL_MENU)
  async showFloatingBallMenu(event: Electron.IpcMainInvokeEvent): Promise<ApiResponse<void>> {
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
    return { code: 0, msg: "success" };
  }
}
