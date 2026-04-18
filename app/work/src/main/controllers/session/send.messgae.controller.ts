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
    if (request.selectedSkills && request.selectedSkills.length > 0) {
      for (const skill of request.selectedSkills) {
        if (!skill.name?.trim()) {
          return new Error("skill name is required");
        }
        if (!skill.filePath?.trim()) {
          return new Error("skill filePath is required");
        }
        if (skill.scope !== "global" && skill.scope !== "workspace") {
          return new Error("skill scope is invalid");
        }
      }
    }
    return undefined;
  }
}
