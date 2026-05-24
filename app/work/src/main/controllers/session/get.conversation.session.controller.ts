import { SessionService } from "@main/service/session.service";
import type {
  ApiResponse,
  GetConversationSessionRequest,
  GetConversationSessionResponse,
} from "@shared/api";
import { GET_CONVERSATION_SESSION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetConversationSessionController extends IPCBaseController<
  GetConversationSessionRequest | undefined,
  GetConversationSessionResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(GET_CONVERSATION_SESSION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request?: GetConversationSessionRequest,
  ): Promise<ApiResponse<GetConversationSessionResponse>> {
    const data = await this.sessionService.getOrCreateConversationSession(request?.sessionId);
    return this.buildResponse(data);
  }

  checkParams(_request?: GetConversationSessionRequest): Error | undefined {
    return undefined;
  }
}
