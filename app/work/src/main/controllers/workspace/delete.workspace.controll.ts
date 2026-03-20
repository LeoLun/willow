import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
} from "@shared/api";
import { DELETE_WORKSPACE } from "@shared/constants";

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
    if (error) {
      return this.buildError(400, error.message);
    }

    const workspace = await this.workspaceService.deleteWorkspace(request.id);
    return this.buildResponse({ workspace });
  }

  checkParams(request: DeleteWorkspaceRequest): Error | undefined {
    if (!request || !request.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
