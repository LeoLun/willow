import { WorkspaceNotFoundError, WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  OpenWorkspaceDirectoryRequest,
  OpenWorkspaceDirectoryResponse,
} from "@shared/api";
import { OPEN_WORKSPACE_DIRECTORY } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { shell } from "electron";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "./workspace-controller.params";

@Injectable()
export class OpenWorkspaceDirectoryController extends IPCBaseController<
  OpenWorkspaceDirectoryRequest,
  OpenWorkspaceDirectoryResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(OPEN_WORKSPACE_DIRECTORY)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: OpenWorkspaceDirectoryRequest,
  ): Promise<ApiResponse<OpenWorkspaceDirectoryResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      const workspace = this.workspaceService.getWorkspaceDetail(request.workspaceId);
      const openError = await shell.openPath(workspace.path);
      if (openError) throw new Error(openError);
      return this.buildResponse({});
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: OpenWorkspaceDirectoryRequest): Error | undefined {
    return checkWorkspaceId(request);
  }
}
