import { SessionService } from "@main/service/session.service";
import type {
  ApiResponse,
  GetWorkspaceSessionsRequest,
  GetWorkspaceSessionsResponse,
} from "@shared/api";
import { GET_WORKSPACE_SESSIONS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceSessionsController extends IPCBaseController<
  GetWorkspaceSessionsRequest,
  GetWorkspaceSessionsResponse
> {
  constructor(private readonly sessionService: SessionService) {
    super();
  }

  @IPC(GET_WORKSPACE_SESSIONS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetWorkspaceSessionsRequest,
  ): Promise<ApiResponse<GetWorkspaceSessionsResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const { workspaceId, page, pageSize } = request;
    const data = await this.sessionService.getWorkspaceSessionsPaginated(
      workspaceId,
      page,
      pageSize,
    );
    return this.buildResponse(data);
  }

  checkParams(request: GetWorkspaceSessionsRequest): Error | undefined {
    if (!request || typeof request.workspaceId !== "number") {
      return new Error("workspaceId is required");
    }
    if (typeof request.page !== "number" || request.page < 1) {
      return new Error("page must be a positive number");
    }
    if (typeof request.pageSize !== "number" || request.pageSize < 1) {
      return new Error("pageSize must be a positive number");
    }
    return undefined;
  }
}
