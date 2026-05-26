import { McpServerService } from "@main/service/mcp-server.service";
import type { ApiResponse, AddMcpServerRequest, AddMcpServerResponse } from "@shared/api";
import { ADD_MCP_SERVER } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class AddMcpServerController extends IPCBaseController<
  AddMcpServerRequest,
  AddMcpServerResponse
> {
  constructor(private readonly mcpServerService: McpServerService) {
    super();
  }

  @IPC(ADD_MCP_SERVER)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: AddMcpServerRequest,
  ): Promise<ApiResponse<AddMcpServerResponse>> {
    if (!request?.config?.name) {
      return this.buildError(400, "Server name is required");
    }

    try {
      const servers = await this.mcpServerService.addServer(request.workspaceId, request.config);
      return this.buildResponse({ servers });
    } catch (error) {
      return this.buildError(500, error instanceof Error ? error.message : "Add MCP server failed");
    }
  }

  checkParams(request: AddMcpServerRequest): Error | undefined {
    if (!request?.config?.name) {
      return new Error("name is required");
    }
    return undefined;
  }
}
