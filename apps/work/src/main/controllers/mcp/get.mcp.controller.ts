import { McpService } from "@main/service/mcp.service";
import type { ApiResponse, GetMcpRequest, GetMcpResponse } from "@shared/api";
import { GET_MCP } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMcpTarget } from "./mcp-controller.params";

@Injectable()
export class GetMcpController extends IPCBaseController<GetMcpRequest, GetMcpResponse> {
  constructor(private readonly service: McpService) {
    super();
  }
  @IPC(GET_MCP)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetMcpRequest,
  ): Promise<ApiResponse<GetMcpResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse(
      await this.service.get(request.scope === "global" ? 0 : request.workspaceId),
    );
  }
  checkParams(request: GetMcpRequest) {
    return checkMcpTarget(request);
  }
}
