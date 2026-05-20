import { AiAppViewService } from "@main/service/ai-app-view.service";
import type { AiAppLoadRequest, ApiResponse } from "@shared/api";
import { AI_APP_LOAD } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { BrowserWindow } from "electron";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class AiAppLoadController extends IPCBaseController<AiAppLoadRequest, void> {
  constructor(private readonly aiAppViewService: AiAppViewService) {
    super();
  }

  @IPC(AI_APP_LOAD)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: AiAppLoadRequest,
  ): Promise<ApiResponse<void>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (!mainWindow) {
      return this.buildError(400, "no main window");
    }

    this.aiAppViewService.showApp(request.workspaceRoot, mainWindow);
    return this.buildResponse(undefined);
  }

  checkParams(request: AiAppLoadRequest): Error | undefined {
    if (!request || typeof request.workspaceRoot !== "string") {
      return new Error("workspaceRoot is required");
    }
    return undefined;
  }
}
