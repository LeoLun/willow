import { McpServerService } from "@main/service/mcp-server.service";
import type { ApiResponse, ToggleMcpServerRequest, ToggleMcpServerResponse } from "@shared/api";
import { TOGGLE_MCP_SERVER } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class ToggleMcpServerController extends IPCBaseController<
  ToggleMcpServerRequest,
  ToggleMcpServerResponse
> {
  constructor(private readonly mcpServerService: McpServerService) {
    super();
  }

  @IPC(TOGGLE_MCP_SERVER)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ToggleMcpServerRequest,
  ): Promise<ApiResponse<ToggleMcpServerResponse>> {
    if (!request?.name) {
      return this.buildError(400, "Server name is required");
    }

    try {
      const servers = await this.mcpServerService.toggleServer(
        request.workspaceId,
        request.name,
        request.disabled,
      );
      return this.buildResponse({ servers });
    } catch (error) {
      return this.buildError(
        500,
        error instanceof Error ? error.message : "Toggle MCP server failed",
      );
    }
  }

  checkParams(request: ToggleMcpServerRequest): Error | undefined {
    if (!request?.name) {
      return new Error("name is required");
    }
    return undefined;
  }
}
