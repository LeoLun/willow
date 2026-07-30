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
    if (error) return this.buildError(400, error.message);

    const session = await this.sessionService.createSession(request.workspaceId);
    return this.buildResponse({ sessionId: session.id });
  }

  checkParams(request: CreateSessionRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }
    if (!Number.isInteger(request.workspaceId) || request.workspaceId <= 0) {
      return new Error("workspaceId must be a positive integer");
    }
    return undefined;
  }
}
