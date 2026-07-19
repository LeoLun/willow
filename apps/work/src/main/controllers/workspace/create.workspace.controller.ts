import { WorkspacePathConflictError, WorkspaceService } from "@main/service/workspace.service";
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
    if (error) return this.buildError(400, error.message);

    try {
      const workspace = this.workspaceService.createWorkspace(request.name, request.path);
      return this.buildResponse({ workspace });
    } catch (error) {
      if (error instanceof WorkspacePathConflictError) {
        return this.buildError(409, "Workspace path already exists");
      }
      throw error;
    }
  }

  checkParams(request: CreateWorkspaceRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }
    if (typeof request.name !== "string" || request.name.trim() === "") {
      return new Error("name must be a non-empty string");
    }
    if (typeof request.path !== "string" || request.path.trim() === "") {
      return new Error("path must be a non-empty string");
    }
    return undefined;
  }
}
