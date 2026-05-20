import { WorkspaceAgentService } from "@main/service/workspace-agent.service";
import type {
  ApiResponse,
  GetWorkspaceAgentsRequest,
  GetWorkspaceAgentsResponse,
} from "@shared/api";
import { GET_WORKSPACE_AGENTS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetWorkspaceAgentsController extends IPCBaseController<
  GetWorkspaceAgentsRequest,
  GetWorkspaceAgentsResponse
> {
  constructor(private readonly workspaceAgentService: WorkspaceAgentService) {
    super();
  }

  @IPC(GET_WORKSPACE_AGENTS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetWorkspaceAgentsRequest,
  ): Promise<ApiResponse<GetWorkspaceAgentsResponse>> {
    const data = await this.workspaceAgentService.getWorkspaceAgents();
    return this.buildResponse(data);
  }

  checkParams(_request: GetWorkspaceAgentsRequest): Error | undefined {
    return undefined;
  }
}
