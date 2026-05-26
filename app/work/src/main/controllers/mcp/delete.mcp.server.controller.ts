import { McpServerService } from "@main/service/mcp-server.service";
import type { ApiResponse, DeleteMcpServerRequest, DeleteMcpServerResponse } from "@shared/api";
import { DELETE_MCP_SERVER } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class DeleteMcpServerController extends IPCBaseController<
  DeleteMcpServerRequest,
  DeleteMcpServerResponse
> {
  constructor(private readonly mcpServerService: McpServerService) {
    super();
  }

  @IPC(DELETE_MCP_SERVER)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: DeleteMcpServerRequest,
  ): Promise<ApiResponse<DeleteMcpServerResponse>> {
    if (!request?.name) {
      return this.buildError(400, "Server name is required");
    }

    try {
      const servers = await this.mcpServerService.deleteServer(request.workspaceId, request.name);
      return this.buildResponse({ servers });
    } catch (error) {
      return this.buildError(
        500,
        error instanceof Error ? error.message : "Delete MCP server failed",
      );
    }
  }

  checkParams(request: DeleteMcpServerRequest): Error | undefined {
    if (!request?.name) {
      return new Error("name is required");
    }
    return undefined;
  }
}
