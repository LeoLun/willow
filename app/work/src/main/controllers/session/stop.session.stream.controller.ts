import { SessionService } from "@main/service/session.service";
import type { ApiResponse, StopSessionStreamRequest, StopSessionStreamResponse } from "@shared/api";
import { STOP_SESSION_STREAM } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class StopSessionStreamController extends IPCBaseController<
  StopSessionStreamRequest,
  StopSessionStreamResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(STOP_SESSION_STREAM)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: StopSessionStreamRequest,
  ): Promise<ApiResponse<StopSessionStreamResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    this.sessionService.stopSessionStream(request.sessionId);
    return this.buildResponse({});
  }

  checkParams(request: StopSessionStreamRequest): Error | undefined {
    if (!request || typeof request.sessionId !== "number") {
      return new Error("sessionId is required");
    }
    return undefined;
  }
}
