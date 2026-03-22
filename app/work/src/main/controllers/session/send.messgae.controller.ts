import { Injectable, IPC } from "@willow/poetry";
import { SessionService } from "@main/service/session.service";
import { IPCBaseController } from "../ipc.base.controller";
import type {
  ApiResponse,
  SendMessageRequest,
  SendMessageResponse,
} from "@shared/api";
import { SEND_MESSAGE } from "@shared/constants";

@Injectable()
export class SendMessageController extends IPCBaseController<
  SendMessageRequest,
  SendMessageResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(SEND_MESSAGE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SendMessageRequest,
  ): Promise<ApiResponse<SendMessageResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { sessionId } = request;

    await this.sessionService.sendMessage(sessionId, request);
    return this.buildResponse({});
  }

  checkParams(request: SendMessageRequest): Error | undefined {
    if (!request || !request.sessionId) {
      return new Error("sessionId is required");
    }
    if (!request || !request.message) {
      return new Error("message is required");
    }
    if (request.files && request.files.length > 0) {
      for (const file of request.files) {
        if (!file.name || !file.path) {
          return new Error("file name or path is required");
        }
      }
    }
    return undefined;
  }
}
