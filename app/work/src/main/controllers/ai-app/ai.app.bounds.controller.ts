import { AiAppViewService } from "@main/service/ai-app-view.service";
import type { AiAppBoundsRequest, ApiResponse } from "@shared/api";
import { AI_APP_BOUNDS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class AiAppBoundsController extends IPCBaseController<AiAppBoundsRequest, void> {
  constructor(private readonly aiAppViewService: AiAppViewService) {
    super();
  }

  @IPC(AI_APP_BOUNDS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: AiAppBoundsRequest,
  ): Promise<ApiResponse<void>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    this.aiAppViewService.setBounds(request);
    return this.buildResponse(undefined);
  }

  checkParams(request: AiAppBoundsRequest): Error | undefined {
    if (!request) {
      return new Error("request is required");
    }
    if (
      typeof request.x !== "number" ||
      typeof request.y !== "number" ||
      typeof request.width !== "number" ||
      typeof request.height !== "number"
    ) {
      return new Error("x, y, width, height must be numbers");
    }
    return undefined;
  }
}
