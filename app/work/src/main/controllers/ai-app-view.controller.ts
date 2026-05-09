import type { AiAppBoundsRequest, AiAppLoadRequest, ApiResponse } from "@shared/api";
import { AI_APP_BOUNDS, AI_APP_CLOSE, AI_APP_LOAD } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { BrowserWindow } from "electron";
import { AiAppViewService } from "../service/ai-app-view.service";

@Injectable()
export class AiAppViewController {
  constructor(private readonly aiAppViewService: AiAppViewService) {}

  @IPC(AI_APP_LOAD)
  async load(
    _event: Electron.IpcMainInvokeEvent,
    request: AiAppLoadRequest,
  ): Promise<ApiResponse<void>> {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) return { code: 400, msg: "no main window" };
    this.aiAppViewService.showApp(request.workspaceRoot, mainWindow);
    return { code: 0, msg: "ok" };
  }

  @IPC(AI_APP_BOUNDS)
  async updateBounds(
    _event: Electron.IpcMainInvokeEvent,
    request: AiAppBoundsRequest,
  ): Promise<ApiResponse<void>> {
    this.aiAppViewService.setBounds(request);
    return { code: 0, msg: "ok" };
  }

  @IPC(AI_APP_CLOSE)
  async close(): Promise<ApiResponse<void>> {
    this.aiAppViewService.hideView();
    return { code: 0, msg: "ok" };
  }
}
