import { WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  GetWorkspaceSettingsRequest,
  GetWorkspaceSettingsResponse,
} from "@shared/api";
import { GET_WORKSPACE_SETTINGS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceSettingsController extends IPCBaseController<
  GetWorkspaceSettingsRequest,
  GetWorkspaceSettingsResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_SETTINGS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetWorkspaceSettingsRequest,
  ): Promise<ApiResponse<GetWorkspaceSettingsResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    try {
      const data = await this.workspaceService.getWorkspaceSettings(request.id);
      return this.buildResponse(data);
    } catch (error) {
      return this.buildError(
        400,
        error instanceof Error ? error.message : "get workspace settings failed",
      );
    }
  }

  checkParams(request: GetWorkspaceSettingsRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    return undefined;
  }
}
