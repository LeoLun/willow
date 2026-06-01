import { WorkspaceService } from "@main/service/workspace.service";
import type { ApiResponse, GetWorkspaceTemplatesResponse } from "@shared/api";
import { GET_WORKSPACE_TEMPLATES } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceTemplatesController extends IPCBaseController<
  void,
  GetWorkspaceTemplatesResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_TEMPLATES)
  async run(): Promise<ApiResponse<GetWorkspaceTemplatesResponse>> {
    try {
      const templates = await this.workspaceService.getWorkspaceTemplates();
      return this.buildResponse({ templates });
    } catch (e: any) {
      return this.buildError(500, e.message || "Failed to get workspace templates");
    }
  }

  checkParams(): Error | undefined {
    return undefined;
  }
}
