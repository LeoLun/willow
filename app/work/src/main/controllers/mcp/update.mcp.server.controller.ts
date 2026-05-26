import { McpServerService } from "@main/service/mcp-server.service";
import type { ApiResponse, UpdateMcpServerRequest, UpdateMcpServerResponse } from "@shared/api";
import { UPDATE_MCP_SERVER } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class UpdateMcpServerController extends IPCBaseController<
  UpdateMcpServerRequest,
  UpdateMcpServerResponse
> {
  constructor(private readonly mcpServerService: McpServerService) {
    super();
  }

  @IPC(UPDATE_MCP_SERVER)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: UpdateMcpServerRequest,
  ): Promise<ApiResponse<UpdateMcpServerResponse>> {
    if (!request?.config?.name) {
      return this.buildError(400, "Server name is required");
    }

    try {
      const servers = await this.mcpServerService.updateServer(request.workspaceId, request.config);
      return this.buildResponse({ servers });
    } catch (error) {
      return this.buildError(
        500,
        error instanceof Error ? error.message : "Update MCP server failed",
      );
    }
  }

  checkParams(request: UpdateMcpServerRequest): Error | undefined {
    if (!request?.config?.name) {
      return new Error("name is required");
    }
    return undefined;
  }
}
