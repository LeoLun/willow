import { WorkspaceService } from "@main/service/workspace.service";
import type {
  ApiResponse,
  UpdateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsResponse,
} from "@shared/api";
import { UPDATE_WORKSPACE_SETTINGS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class UpdateWorkspaceSettingsController extends IPCBaseController<
  UpdateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(UPDATE_WORKSPACE_SETTINGS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: UpdateWorkspaceSettingsRequest,
  ): Promise<ApiResponse<UpdateWorkspaceSettingsResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    try {
      const data = await this.workspaceService.updateWorkspaceSettings(
        request.id,
        request.path,
        request.soulContent,
      );
      return this.buildResponse(data);
    } catch (error) {
      return this.buildError(
        400,
        error instanceof Error ? error.message : "update workspace settings failed",
      );
    }
  }

  checkParams(request: UpdateWorkspaceSettingsRequest): Error | undefined {
    if (!request?.id) {
      return new Error("id is required");
    }
    if (!request.path?.trim()) {
      return new Error("path is required");
    }
    if (typeof request.soulContent !== "string") {
      return new Error("soulContent is required");
    }
    return undefined;
  }
}
