import { WorkspaceService } from "@main/service/workspace.service";
import { ApiResponse, GetWorkspaceListResponse } from "@shared/api";
import { GET_WORKSPACE_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceListController extends IPCBaseController<
  undefined,
  GetWorkspaceListResponse
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  @IPC(GET_WORKSPACE_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: undefined,
  ): Promise<ApiResponse<GetWorkspaceListResponse>> {
    const error = this.checkParams();
    if (error) {
      return this.buildError(400, error.message);
    }
    const data = await this.workspaceService.getWorkspaceList();
    const response = this.buildResponse({ workspaces: data });
    return response;
  }

  checkParams(): Error | undefined {
    return undefined;
  }

  buildResponse(data: GetWorkspaceListResponse): ApiResponse<GetWorkspaceListResponse> {
    return {
      code: 0,
      msg: "ok",
      data,
    };
  }
}
