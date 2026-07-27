import { DEFAULT_MAX_BYTES, truncateHead, type AgentTool } from "@earendil-works/pi-agent-core";
import minimatch from "minimatch";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { resolveSearchFiles } from "./search-files.js";
import { authorizeRead } from "./shared.js";
import type { FindToolDetails, ToolRuntimeOptions } from "./types.js";

const findSchema = Type.Object({
  pattern: Type.String({ description: "Glob pattern to match files" }),
  path: Type.Optional(Type.String({ description: "Directory to search" })),
  limit: Type.Optional(Type.Number({ description: "Maximum results (default: 1000)" })),
});

export type FindToolInput = Static<typeof findSchema>;

export class FindTool extends ToolBase<typeof findSchema, FindToolDetails> {
  readonly name = "find";
  readonly label = "find";
  readonly description = "Find files by glob pattern, respecting .gitignore.";
  readonly parameters = findSchema;

  protected override checkParams(input: FindToolInput): Error | undefined {
    const limit = input.limit ?? 1000;
    if (!Number.isInteger(limit) || limit < 1) return new Error("limit must be at least 1");
    return undefined;
  }

  protected override async checkPermission(
    context: ToolExecutionContext<FindToolInput, FindToolDetails>,
  ): Promise<void> {
    await authorizeRead({
      ...this.options,
      path: context.input.path || ".",
      toolCallId: context.toolCallId,
      toolName: this.name,
      input: context.input,
      signal: context.signal,
    });
  }

  protected override async run(context: ToolExecutionContext<FindToolInput, FindToolDetails>) {
    const { input, signal } = context;
    const limit = input.limit ?? 1000;
    const files = await resolveSearchFiles(this.options.cwd, input.path, signal);
    const matches = files
      .map((file) => file.relativePath)
      .filter((path) => minimatch(path, input.pattern, { dot: true, matchBase: true }))
      .sort()
      .slice(0, limit);
    const truncation = truncateHead(matches.join("\n"), { maxBytes: DEFAULT_MAX_BYTES });
    return this.buildResponse([{ type: "text", text: truncation.content || "No files found" }], {
      msg: `搜索文件 ${input.pattern}，找到 ${matches.length} 个`,
      kind: "find",
      pattern: input.pattern,
      resultCount: matches.length,
      truncation: truncation.truncated ? truncation : undefined,
      resultLimitReached: matches.length >= limit ? limit : undefined,
    });
  }
}

export function createFindTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof findSchema, FindToolDetails> {
  return new FindTool(options);
}
