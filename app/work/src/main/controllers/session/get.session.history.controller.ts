import { Injectable, IPC } from "@willow/poetry";
import { SessionService } from "@main/service/session.service";
import { IPCBaseController } from "../ipc.base.controller";
import type {
  ApiResponse,
  GetSessionHistoryRequest,
  GetSessionHistoryResponse,
} from "@shared/api";
import { GET_SESSION_HISTORY } from "@shared/constants";

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

    const messages = this.sessionService.getSessionHistoryAgentMessages(
      request.sessionId,
    );
    return this.buildResponse({ messages });
  }

  checkParams(request: GetSessionHistoryRequest): Error | undefined {
    if (!request || typeof request.sessionId !== "number") {
      return new Error("sessionId is required");
    }
    return undefined;
  }
}
