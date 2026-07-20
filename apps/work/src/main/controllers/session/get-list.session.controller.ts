import { SessionService } from "@main/service/session.service";
import type {
  ApiResponse,
  GetSessionListRequest,
  GetSessionListResponse,
  SessionInfo,
} from "@shared/api";
import { GET_SESSION_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetSessionListController extends IPCBaseController<
  GetSessionListRequest,
  GetSessionListResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(GET_SESSION_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetSessionListRequest,
  ): Promise<ApiResponse<GetSessionListResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    const sessions = await this.sessionService.getSessionList(request.workspaceId);
    return this.buildResponse({
      sessions: sessions.map<SessionInfo>(({ id, workspaceId, title, createdAt }) => ({
        id,
        workspaceId,
        title,
        createdAt,
        status: "completed",
      })),
    });
  }

  checkParams(request: GetSessionListRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }
    if (!Number.isInteger(request.workspaceId) || request.workspaceId <= 0) {
      return new Error("workspaceId must be a positive integer");
    }
    return undefined;
  }
}
