import { MessageService } from "@main/service/message.service";
import type { ApiResponse, StopMessageRequest, StopMessageResponse } from "@shared/api";
import { STOP_MESSAGE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMessageSessionParams } from "./message-controller.params";

@Injectable()
export class StopMessageController extends IPCBaseController<
  StopMessageRequest,
  StopMessageResponse
> {
  constructor(private readonly messageService: MessageService) {
    super();
  }

  @IPC(STOP_MESSAGE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: StopMessageRequest,
  ): Promise<ApiResponse<StopMessageResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const stopped = await this.messageService.stopMessage(request.workspaceId, request.sessionId);
    return this.buildResponse({ stopped });
  }

  checkParams(request: StopMessageRequest): Error | undefined {
    return checkMessageSessionParams(request);
  }
}
