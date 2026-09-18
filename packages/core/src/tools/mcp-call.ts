import type { AgentToolResult } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { McpToolDetails } from "./types.js";

const parameters = Type.Object({
  serverName: Type.String({ minLength: 1 }),
  toolName: Type.String({ minLength: 1 }),
  arguments: Type.Record(Type.String(), Type.Unknown()),
});
export type McpCallToolInput = Static<typeof parameters>;
export class McpCallTool extends ToolBase<typeof parameters, McpToolDetails> {
  readonly name = "mcpCall";
  readonly label = "调用 MCP 工具";
  readonly description =
    "Call a discovered MCP tool with arguments matching mcpDescribe. Calls require session permission evaluation and never automatically replay on failure.";
  readonly parameters = parameters;
  protected async run(context: ToolExecutionContext<McpCallToolInput, McpToolDetails>) {
    if (
      !this.options.mcp ||
      context.approvalAction.type !== "mcp" ||
      this.options.agentMode === "plan"
    )
      throw new Error("MCP execution is unavailable.");
    const result = await this.options.mcp.call(
      context.input,
      context.approvalAction.fingerprint,
      context.signal,
    );
    const content: AgentToolResult<McpToolDetails>["content"] = [];
    let remaining = 50 * 1024;
    let linesRemaining = 2000;
    let imageBudget = 10 * 1024 * 1024;
    let truncated = false;
    const append = (text: string) => {
      let bounded = text.split("\n").slice(0, linesRemaining).join("\n");
      bounded = Buffer.from(bounded).subarray(0, remaining).toString("utf8");
      while (Buffer.byteLength(bounded) > remaining) bounded = bounded.slice(0, -1);
      truncated ||= bounded.length < text.length;
      remaining -= Buffer.byteLength(bounded);
      linesRemaining = Math.max(0, linesRemaining - bounded.split("\n").length);
      if (bounded) content.push({ type: "text", text: bounded });
    };
    for (const block of result.content) {
      if (block.type === "text") append(block.text);
      else if (
        block.type === "image" &&
        Buffer.byteLength(block.data, "base64") <= Math.min(imageBudget, 5 * 1024 * 1024)
      ) {
        imageBudget -= Buffer.byteLength(block.data, "base64");
        content.push({ type: "image", data: block.data, mimeType: block.mimeType });
      } else
        append(
          JSON.stringify(
            block.type === "image" ? { type: "image", omitted: "Image exceeds 5MB" } : block,
          ),
        );
    }
    if (result.structuredContent) append(JSON.stringify(result.structuredContent));
    if (truncated) content.push({ type: "text", text: "[MCP output truncated]" });
    if (!content.length)
      content.push({
        type: "text",
        text: result.isError ? "MCP tool failed." : "MCP tool completed.",
      });
    return this.buildResponse(content, {
      kind: "mcp",
      msg: result.isError ? "MCP tool failed" : "MCP tool completed",
      serverName: context.input.serverName,
      toolName: context.input.toolName,
      truncated,
      isError: result.isError === true,
    });
  }
}
