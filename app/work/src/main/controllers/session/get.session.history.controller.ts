import { SessionService } from "@main/service/session.service";
import type { ApiResponse, GetSessionHistoryRequest, GetSessionHistoryResponse } from "@shared/api";
import { GET_SESSION_HISTORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetSessionHistoryController extends IPCBaseController<
  GetSessionHistoryRequest,
  GetSessionHistoryResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(GET_SESSION_HISTORY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetSessionHistoryRequest,
  ): Promise<ApiResponse<GetSessionHistoryResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const messages = this.sessionService.getSessionHistoryAgentMessages(request.sessionId);
    const activeStream = this.sessionService.getActiveSessionStream(request.sessionId);
    return this.buildResponse({ messages, activeStream });
  }

  checkParams(request: GetSessionHistoryRequest): Error | undefined {
    if (!request || typeof request.sessionId !== "number") {
      return new Error("sessionId is required");
    }
    return undefined;
  }
}
