import { SessionService } from "@main/service/session.service";
import { WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, GetSessionRequest, GetSessionResponse } from "@shared/api";
import { GET_SESSION } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetSessionController extends IPCBaseController<GetSessionRequest, GetSessionResponse> {
  constructor(
    private readonly sessionService: SessionService,
    private readonly workspaceService: WorkspaceService,
  ) {
    super();
  }

  @IPC(GET_SESSION)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetSessionRequest,
  ): Promise<ApiResponse<GetSessionResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const session = await this.sessionService.getSessionById(request.sessionId);
    if (!session) {
      return this.buildError(404, "session not found");
    }

    const workspace = await this.workspaceService.getWorkspaceInfo(session.workspaceId);
    if (!workspace) {
      return this.buildError(404, "workspace not found");
    }

    return this.buildResponse({ session, workspace });
  }

  checkParams(request: GetSessionRequest): Error | undefined {
    if (!request || typeof request.sessionId !== "number") {
      return new Error("sessionId is required");
    }
    return undefined;
  }
}
