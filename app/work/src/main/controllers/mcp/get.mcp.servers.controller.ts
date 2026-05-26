import { McpServerService } from "@main/service/mcp-server.service";
import type { ApiResponse, GetMcpServersRequest, GetMcpServersResponse } from "@shared/api";
import { GET_MCP_SERVERS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetMcpServersController extends IPCBaseController<
  GetMcpServersRequest,
  GetMcpServersResponse
> {
  constructor(private readonly mcpServerService: McpServerService) {
    super();
  }

  @IPC(GET_MCP_SERVERS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetMcpServersRequest,
  ): Promise<ApiResponse<GetMcpServersResponse>> {
    try {
      const servers = await this.mcpServerService.getServers(request?.workspaceId);
      return this.buildResponse({ servers });
    } catch (error) {
      return this.buildError(
        500,
        error instanceof Error ? error.message : "Get MCP servers failed",
      );
    }
  }

  checkParams(_request: GetMcpServersRequest): Error | undefined {
    return undefined;
  }
}
