import { readFile } from "node:fs/promises";
import {
  DEFAULT_MAX_BYTES,
  truncateHead,
  truncateLine,
  type AgentTool,
} from "@earendil-works/pi-agent-core";
import minimatch from "minimatch";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { resolveSearchFiles } from "./search-files.js";
import { authorizeRead, throwIfAborted } from "./shared.js";
import type { GrepToolDetails, ToolRuntimeOptions } from "./types.js";

const grepSchema = Type.Object({
  pattern: Type.String({ description: "Search pattern (regex or literal string)" }),
  path: Type.Optional(Type.String({ description: "Directory or file to search" })),
  glob: Type.Optional(Type.String({ description: "Filter files by glob pattern" })),
  ignoreCase: Type.Optional(Type.Boolean()),
  literal: Type.Optional(Type.Boolean()),
  context: Type.Optional(Type.Number({ description: "Context lines before and after matches" })),
  limit: Type.Optional(Type.Number({ description: "Maximum matches (default: 100)" })),
});

export type GrepToolInput = Static<typeof grepSchema>;

export class GrepTool extends ToolBase<typeof grepSchema, GrepToolDetails> {
  readonly name = "grep";
  readonly label = "grep";
  readonly description = "Search text files for a regular expression or literal string.";
  readonly parameters = grepSchema;

  protected override checkParams(input: GrepToolInput): Error | undefined {
    const limit = input.limit ?? 100;
    const context = input.context ?? 0;
    if (!Number.isInteger(limit) || limit < 1) return new Error("limit must be at least 1");
    if (!Number.isInteger(context) || context < 0) {
      return new Error("context must be non-negative");
    }
    if (!input.literal) {
      try {
        new RegExp(input.pattern, input.ignoreCase ? "i" : "");
      } catch (error) {
        return error instanceof Error ? error : new Error(String(error));
      }
    }
    return undefined;
  }

  protected override async checkPermission(
    context: ToolExecutionContext<GrepToolInput, GrepToolDetails>,
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

  protected override async run(context: ToolExecutionContext<GrepToolInput, GrepToolDetails>) {
    const { input, signal } = context;
    const limit = input.limit ?? 100;
    const contextLines = input.context ?? 0;
    const flags = input.ignoreCase ? "i" : "";
    const expression = input.literal
      ? new RegExp(input.pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), flags)
      : new RegExp(input.pattern, flags);
    const files = await resolveSearchFiles(this.options.cwd, input.path, signal);
    const output: string[] = [];
    let matchCount = 0;
    let linesTruncated = false;

    for (const file of files) {
      if (input.glob && !minimatch(file.relativePath, input.glob, { dot: true, matchBase: true })) {
        continue;
      }
      throwIfAborted(signal);
      const buffer = await readFile(file.absolutePath);
      if (buffer.includes(0)) continue;
      const lines = buffer.toString("utf8").split(/\r\n|\n|\r/);
      const included = new Set<number>();
      for (let index = 0; index < lines.length && matchCount < limit; index += 1) {
        expression.lastIndex = 0;
        if (!expression.test(lines[index])) continue;
        matchCount += 1;
        for (
          let contextIndex = Math.max(0, index - contextLines);
          contextIndex <= Math.min(lines.length - 1, index + contextLines);
          contextIndex += 1
        ) {
          included.add(contextIndex);
        }
      }
      for (const index of [...included].sort((left, right) => left - right)) {
        const truncated = truncateLine(lines[index]);
        linesTruncated ||= truncated.wasTruncated;
        output.push(`${file.relativePath}:${index + 1}:${truncated.text}`);
      }
      if (matchCount >= limit) break;
    }

    const rawOutput = output.join("\n");
    const truncation = truncateHead(rawOutput, { maxBytes: DEFAULT_MAX_BYTES });
    const details: GrepToolDetails = {
      msg: `搜索内容 ${input.pattern}，匹配 ${matchCount} 处`,
      kind: "grep",
      pattern: input.pattern,
      matchCount,
      truncation: truncation.truncated ? truncation : undefined,
      matchLimitReached: matchCount >= limit ? limit : undefined,
      linesTruncated: linesTruncated || undefined,
    };
    return this.buildResponse(
      [{ type: "text", text: truncation.content || "No matches found" }],
      details,
    );
  }
}

export function createGrepTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof grepSchema, GrepToolDetails> {
  return new GrepTool(options);
}
