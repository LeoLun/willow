import { WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, GetWorkspaceListRequest, GetWorkspaceListResponse } from "@shared/api";
import { GET_WORKSPACE_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceListController extends IPCBaseController<
  GetWorkspaceListRequest,
  GetWorkspaceListResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetWorkspaceListRequest,
  ): Promise<ApiResponse<GetWorkspaceListResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    return this.buildResponse({
      workspaces: this.workspaceService.getWorkspaceList(request.pinned),
    });
  }

  checkParams(request: GetWorkspaceListRequest): Error | undefined {
    if (!request || typeof request !== "object" || typeof request.pinned !== "boolean") {
      return new Error("pinned must be a boolean");
    }
    return undefined;
  }
}
