import type { McpTarget } from "@shared/api";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

export function checkMcpTarget(request: McpTarget): Error | undefined {
  if (!request || typeof request !== "object") return new Error("Invalid MCP target.");
  if (request.scope === "global")
    return request.workspaceId === undefined ? undefined : new Error("Invalid global MCP target.");
  if (request.scope !== undefined && request.scope !== "project")
    return new Error("Invalid MCP scope.");
  return checkWorkspaceId(request);
}
