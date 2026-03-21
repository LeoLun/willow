import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
} from "@shared/api";
import { RENAME_WORKSPACE } from "@shared/constants";

@Injectable()
export class RenameWorkspaceController extends IPCBaseController<
  RenameWorkspaceRequest,
  RenameWorkspaceResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(RENAME_WORKSPACE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: RenameWorkspaceRequest,
  ): Promise<ApiResponse<RenameWorkspaceResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const workspace = await this.workspaceService.renameWorkspace(
      request.id,
      request.name,
    );
    return this.buildResponse({ workspace });
  }

  checkParams(request: RenameWorkspaceRequest): Error | undefined {
    if (!request || !request.name) {
      return new Error("name is required");
    }
    if (!request.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
