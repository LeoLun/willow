import { WorkspaceNotFoundError, WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  SetWorkspacePinnedRequest,
  SetWorkspacePinnedResponse,
} from "@shared/api";
import { SET_WORKSPACE_PINNED } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "./workspace-controller.params";

@Injectable()
export class SetWorkspacePinnedController extends IPCBaseController<
  SetWorkspacePinnedRequest,
  SetWorkspacePinnedResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(SET_WORKSPACE_PINNED)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetWorkspacePinnedRequest,
  ): Promise<ApiResponse<SetWorkspacePinnedResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      const workspace = this.workspaceService.setWorkspacePinned(
        request.workspaceId,
        request.pinned,
      );
      return this.buildResponse({ workspace });
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: SetWorkspacePinnedRequest): Error | undefined {
    const idError = checkWorkspaceId(request);
    if (idError) return idError;
    if (typeof request.pinned !== "boolean") {
      return new Error("pinned must be a boolean");
    }
    return undefined;
  }
}
