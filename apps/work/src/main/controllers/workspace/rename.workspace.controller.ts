import { WorkspaceNotFoundError, WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, RenameWorkspaceRequest, RenameWorkspaceResponse } from "@shared/api";
import { RENAME_WORKSPACE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "./workspace-controller.params";

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
    if (error) return this.buildError(400, error.message);

    try {
      const workspace = this.workspaceService.renameWorkspace(
        request.workspaceId,
        request.name.trim(),
      );
      return this.buildResponse({ workspace });
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: RenameWorkspaceRequest): Error | undefined {
    const idError = checkWorkspaceId(request);
    if (idError) return idError;
    if (typeof request.name !== "string" || request.name.trim() === "") {
      return new Error("name must be a non-empty string");
    }
    return undefined;
  }
}
