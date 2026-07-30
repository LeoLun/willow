import { MessageService } from "@main/service/message.service";
import type { ApiResponse, GetMessageListRequest, GetMessageListResponse } from "@shared/api";
import { GET_MESSAGE_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMessageSessionParams } from "./message-controller.params";

@Injectable()
export class GetMessageListController extends IPCBaseController<
  GetMessageListRequest,
  GetMessageListResponse
> {
  constructor(private readonly messageService: MessageService) {
    super();
  }

  @IPC(GET_MESSAGE_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetMessageListRequest,
  ): Promise<ApiResponse<GetMessageListResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const response = await this.messageService.getMessageList(
      request.workspaceId,
      request.sessionId,
    );
    return this.buildResponse(response);
  }

  checkParams(request: GetMessageListRequest): Error | undefined {
    return checkMessageSessionParams(request);
  }
}
