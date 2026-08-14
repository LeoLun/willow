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
    if (
      typeof request.content !== "string" ||
      (request.content.trim() === "" &&
        (!Array.isArray(request.attachments) || request.attachments.length === 0))
    ) {
      return new Error("message must include text or an attachment");
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
    if (
      request.agentMode !== undefined &&
      request.agentMode !== "default" &&
      request.agentMode !== "plan"
    ) {
      return new Error("agentMode must be a supported agent mode");
    }
    if (
      request.approvalMode !== undefined &&
      request.approvalMode !== "request-approval" &&
      request.approvalMode !== "delegate-approval" &&
      request.approvalMode !== "full-access"
    ) {
      return new Error("approvalMode must be a supported permission mode");
    }
    if (request.attachments !== undefined) {
      if (!Array.isArray(request.attachments)) {
        return new Error("attachments must be an array");
      }
      for (const attachment of request.attachments) {
        if (
          !attachment ||
          typeof attachment.path !== "string" ||
          attachment.path.trim() === "" ||
          typeof attachment.name !== "string" ||
          attachment.name.trim() === "" ||
          typeof attachment.fileType !== "string" ||
          attachment.fileType.trim() === "" ||
          (attachment.mimeType !== undefined &&
            (typeof attachment.mimeType !== "string" || attachment.mimeType.trim() === ""))
        ) {
          return new Error("attachments must contain valid local files");
        }
      }
    }
    return undefined;
  }
}
