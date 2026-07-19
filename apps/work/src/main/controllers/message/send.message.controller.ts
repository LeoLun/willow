import { MessageService } from "@main/service/message.service";
import type { ApiResponse, SendMessageRequest, SendMessageResponse } from "@shared/api";
import { SEND_MESSAGE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMessageSessionParams } from "./message-controller.params";

@Injectable()
export class SendMessageController extends IPCBaseController<
  SendMessageRequest,
  SendMessageResponse
> {
  constructor(private readonly messageService: MessageService) {
    super();
  }

  @IPC(SEND_MESSAGE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SendMessageRequest,
  ): Promise<ApiResponse<SendMessageResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const message = await this.messageService.sendMessage(request);
    return this.buildResponse({ message });
  }

  checkParams(request: SendMessageRequest): Error | undefined {
    const error = checkMessageSessionParams(request);
    if (error) return error;
    if (typeof request.content !== "string" || request.content.trim() === "") {
      return new Error("content must be a non-empty string");
    }
    if (
      !request.model ||
      typeof request.model.providerId !== "string" ||
      request.model.providerId.trim() === "" ||
      typeof request.model.modelId !== "string" ||
      request.model.modelId.trim() === ""
    ) {
      return new Error("model must include non-empty providerId and modelId");
    }
    return undefined;
  }
}
