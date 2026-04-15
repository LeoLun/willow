import { WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, GetWorkspaceFilesRequest, GetWorkspaceFilesResponse } from "@shared/api";
import { GET_WORKSPACE_FILES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceFilesController extends IPCBaseController<
  GetWorkspaceFilesRequest,
  GetWorkspaceFilesResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_FILES)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetWorkspaceFilesRequest,
  ): Promise<ApiResponse<GetWorkspaceFilesResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    try {
      const data = await this.workspaceService.getWorkspaceFiles(request.id);
      return this.buildResponse(data);
    } catch (error) {
      return this.buildError(
        400,
        error instanceof Error ? error.message : "get workspace files failed",
      );
    }
  }

  checkParams(request: GetWorkspaceFilesRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
