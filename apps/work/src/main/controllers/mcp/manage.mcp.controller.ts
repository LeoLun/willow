import { McpService } from "@main/service/mcp.service";
import type { ApiResponse, ManageMcpRequest, ManageMcpResponse } from "@shared/api";
import { MANAGE_MCP } from "@shared/constants";
import { isStringRecord, validateMcpDefinition, validateMcpName } from "@willow/core";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkMcpTarget } from "./mcp-controller.params";

const actions = [
  "save",
  "delete",
  "connect",
  "disconnect",
  "reconnect",
  "login",
  "cancel-login",
  "logout",
  "set-token",
  "migrate-secrets",
  "tools",
];
@Injectable()
export class ManageMcpController extends IPCBaseController<ManageMcpRequest, ManageMcpResponse> {
  constructor(private readonly service: McpService) {
    super();
  }
  @IPC(MANAGE_MCP)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: ManageMcpRequest,
  ): Promise<ApiResponse<ManageMcpResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);
    return this.buildResponse(await this.service.manage(request));
  }
  checkParams(request: ManageMcpRequest): Error | undefined {
    const error = checkMcpTarget(request);
    if (error) return error;
    try {
      validateMcpName(request.serverName);
      if (!actions.includes(request.action)) throw new Error();
      if (request.action === "save") validateMcpDefinition(request.definition);
      if (
        ["save", "delete", "migrate-secrets"].includes(request.action) &&
        (typeof request.configRevision !== "string" ||
          !/^[a-f0-9]{64}$/.test(request.configRevision))
      )
        throw new Error();
      if (
        request.action === "set-token" &&
        (typeof request.token !== "string" || !request.token.trim() || request.token.length > 65536)
      )
        throw new Error();
      if (
        request.clientSecret !== undefined &&
        (typeof request.clientSecret !== "string" || request.clientSecret.length > 65536)
      )
        throw new Error();
      if (
        request.secrets !== undefined &&
        (!isStringRecord(request.secrets) ||
          Object.entries(request.secrets).some(
            ([k, v]) => !/^[\w.-]{1,200}$/.test(k) || v.length > 65536,
          ))
      )
        throw new Error();
    } catch {
      return new Error("Invalid MCP request parameters.");
    }
    return undefined;
  }
}
