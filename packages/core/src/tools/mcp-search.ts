import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { McpToolDetails } from "./types.js";

const parameters = Type.Object({
  query: Type.String({ maxLength: 1000 }),
  serverName: Type.Optional(Type.String({ minLength: 1 })),
  limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 50 })),
});
export type McpSearchToolInput = Static<typeof parameters>;
export class McpSearchTool extends ToolBase<typeof parameters, McpToolDetails> {
  readonly name = "mcpSearch";
  readonly label = "搜索 MCP 工具";
  readonly description =
    "Search the project's MCP tool catalog by keywords. Use an empty query or '*' to list tools; serverName limits discovery to one configured service. Discover uncached enabled servers on demand. Use mcpDescribe for the complete schema, then mcpCall to execute the selected tool.";
  readonly parameters = parameters;
  protected async run(context: ToolExecutionContext<McpSearchToolInput, McpToolDetails>) {
    if (!this.options.mcp) throw new Error("MCP is unavailable.");
    const result = await this.options.mcp.search(context.input, context.signal);
    return this.buildResponse([{ type: "text", text: JSON.stringify(result) }], {
      kind: "mcp",
      msg: "MCP search completed",
      resultCount: result.results.length,
    });
  }
}
