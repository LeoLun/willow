import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { McpToolDetails } from "./types.js";

const parameters = Type.Object({
  serverName: Type.String({ minLength: 1 }),
  toolName: Type.String({ minLength: 1 }),
});
export type McpDescribeToolInput = Static<typeof parameters>;
export class McpDescribeTool extends ToolBase<typeof parameters, McpToolDetails> {
  readonly name = "mcpDescribe";
  readonly label = "查看 MCP 工具";
  readonly description = "Describe an MCP tool and its full JSON input schema before calling it.";
  readonly parameters = parameters;
  protected async run(context: ToolExecutionContext<McpDescribeToolInput, McpToolDetails>) {
    if (!this.options.mcp) throw new Error("MCP is unavailable.");
    const result = await this.options.mcp.describe(
      context.input.serverName,
      context.input.toolName,
      context.signal,
    );
    return this.buildResponse([{ type: "text", text: JSON.stringify(result) }], {
      kind: "mcp",
      msg: "MCP tool described",
      ...context.input,
    });
  }
}
