import { SessionService } from "@main/service/session.service";
import type {
  Session,
  ApiResponse,
  GetSessionListRequest,
  GetSessionListResponse,
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
    if (error) {
      return this.buildError(400, error.message);
    }

    const { workspaceIds, limit } = request;

    const data = await this.sessionService.getSessionListByWorkspaceIds(workspaceIds, limit);
    const sessions = data.reduce(
      (acc, session) => {
        acc[session.workspaceId] = [...(acc[session.workspaceId] || []), session];
        return acc;
      },
      {} as { [workspaceId: number]: Session[] },
    );

    const response: GetSessionListResponse = { sessions };

    if (limit) {
      response.totals = await this.sessionService.getSessionCountByWorkspaceIds(workspaceIds);
    }

    return this.buildResponse(response);
  }

  checkParams(request: GetSessionListRequest): Error | undefined {
    if (!request || !request.workspaceIds) {
      return new Error("workspaceIds is required");
    }
    if (request.workspaceIds.length === 0) {
      return new Error("workspaceIds must be an array of numbers");
    }
    for (const workspaceId of request.workspaceIds) {
      if (typeof workspaceId !== "number") {
        return new Error("workspaceIds must be an array of numbers");
      }
    }
    return undefined;
  }
}
