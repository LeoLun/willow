import { WorkspaceNotFoundError, WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  GetWorkspaceDetailRequest,
  GetWorkspaceDetailResponse,
} from "@shared/api";
import { GET_WORKSPACE_DETAIL } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "./workspace-controller.params";

@Injectable()
export class GetWorkspaceDetailController extends IPCBaseController<
  GetWorkspaceDetailRequest,
  GetWorkspaceDetailResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_DETAIL)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetWorkspaceDetailRequest,
  ): Promise<ApiResponse<GetWorkspaceDetailResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      const workspace = this.workspaceService.getWorkspaceDetail(request.workspaceId);
      return this.buildResponse({ workspace });
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: GetWorkspaceDetailRequest): Error | undefined {
    return checkWorkspaceId(request);
  }
}
