import { WorkspaceNotFoundError, WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, DeleteWorkspaceRequest, DeleteWorkspaceResponse } from "@shared/api";
import { DELETE_WORKSPACE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "./workspace-controller.params";

@Injectable()
export class DeleteWorkspaceController extends IPCBaseController<
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(DELETE_WORKSPACE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteWorkspaceRequest,
  ): Promise<ApiResponse<DeleteWorkspaceResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      this.workspaceService.deleteWorkspace(request.workspaceId);
      return this.buildResponse({});
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: DeleteWorkspaceRequest): Error | undefined {
    return checkWorkspaceId(request);
  }
}
