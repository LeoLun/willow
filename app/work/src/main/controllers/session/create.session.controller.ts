import { SessionService } from "@main/service/session.service";
import type { ApiResponse, CreateSessionRequest, CreateSessionResponse } from "@shared/api";
import { CREATE_SESSION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class CreateSessionController extends IPCBaseController<
  CreateSessionRequest,
  CreateSessionResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(CREATE_SESSION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: CreateSessionRequest,
  ): Promise<ApiResponse<CreateSessionResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { workspaceId } = request;

    const data = await this.sessionService.createSession(workspaceId);
    return this.buildResponse({ session: data });
  }

  checkParams(request: CreateSessionRequest): Error | undefined {
    if (!request || !request.workspaceId) {
      return new Error("workspaceId is required");
    }
    return undefined;
  }
}
