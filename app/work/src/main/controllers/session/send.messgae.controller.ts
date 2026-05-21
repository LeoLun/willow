import { SessionService } from "@main/service/session.service";
import type { ApiResponse, SendMessageRequest, SendMessageResponse } from "@shared/api";
import { SEND_MESSAGE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

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
    console.log("[SendMessageController] run sessionId=", request.sessionId);
    const error = this.checkParams(request);
    if (error) {
      console.error("[SendMessageController] param error:", error.message);
      return this.buildError(400, error.message);
    }

    const { sessionId } = request;

    try {
      await this.sessionService.sendMessage(sessionId, request);
      console.log("[SendMessageController] sendMessage completed for sessionId=", sessionId);
      return this.buildResponse({});
    } catch (err) {
      console.error("[SendMessageController] sendMessage failed:", err);
      throw err;
    }
  }

  checkParams(request: SendMessageRequest): Error | undefined {
    if (!request || !request.sessionId) {
      return new Error("sessionId is required");
    }
    if (
      !request.message &&
      !request.selectedBuiltinCommand &&
      !request.selectedWorkspaceAgent &&
      (!request.selectedSkills || request.selectedSkills.length === 0)
    ) {
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
