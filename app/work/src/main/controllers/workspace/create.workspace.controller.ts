import { WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, CreateWorkspaceRequest, CreateWorkspaceResponse } from "@shared/api";
import { CREATE_WORKSPACE } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class CreateWorkspaceController extends IPCBaseController<
  CreateWorkspaceRequest,
  CreateWorkspaceResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(CREATE_WORKSPACE)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: CreateWorkspaceRequest,
  ): Promise<ApiResponse<CreateWorkspaceResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const workspace = request.path
      ? await this.workspaceService.createWorkspace(request.name, request.path)
      : await this.workspaceService.createDefaultWorkspace(request.name);
    return this.buildResponse({ workspace });
  }

  checkParams(request: CreateWorkspaceRequest): Error | undefined {
    if (!request || !request.name) {
      return new Error("name is required");
    }
    return undefined;
  }
}
