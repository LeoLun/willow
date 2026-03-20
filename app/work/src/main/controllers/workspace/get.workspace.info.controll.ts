import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse,
} from "@shared/api";
import { GET_WORKSPACE_INFO } from "@shared/constants";

@Injectable()
export class GetWorkspaceInfoController extends IPCBaseController<
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_INFO)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetWorkspaceInfoRequest,
  ): Promise<ApiResponse<GetWorkspaceInfoResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const workspace = await this.workspaceService.getWorkspaceInfo(request.id);
    return this.buildResponse({ workspace });
  }

  checkParams(request: GetWorkspaceInfoRequest): Error | undefined {
    if (!request || !request.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
