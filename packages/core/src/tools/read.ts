import { readFile } from "node:fs/promises";
import {
  DEFAULT_MAX_BYTES,
  DEFAULT_MAX_LINES,
  truncateHead,
  type AgentTool,
} from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { resolveFromCwd, throwIfAborted } from "./shared.js";
import type { ReadToolDetails, ToolRuntimeOptions } from "./types.js";

const readSchema = Type.Object({
  path: Type.String({ description: "Path to the file to read (relative or absolute)" }),
  offset: Type.Optional(
    Type.Number({ description: "Line number to start reading from (1-indexed)" }),
  ),
  limit: Type.Optional(Type.Number({ description: "Maximum number of lines to read" })),
});

export type ReadToolInput = Static<typeof readSchema>;

export class ReadTool extends ToolBase<typeof readSchema, ReadToolDetails> {
  readonly name = "read";
  readonly label = "read";
  readonly description = "Read a UTF-8 text file with optional 1-indexed offset and line limit.";
  readonly parameters = readSchema;

  protected override checkParams(input: ReadToolInput): Error | undefined {
    const offset = input.offset ?? 1;
    if (!Number.isInteger(offset) || offset < 1) return new Error("offset must be at least 1");
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit < 1)) {
      return new Error("limit must be at least 1");
    }
    return undefined;
  }

  protected override async run(context: ToolExecutionContext<ReadToolInput, ReadToolDetails>) {
    const { input, signal } = context;
    const offset = input.offset ?? 1;
    throwIfAborted(signal);
    const absolutePath = resolveFromCwd(this.options.cwd, input.path);
    const content = await readFile(absolutePath, "utf8");
    throwIfAborted(signal);
    const lines = content.replace(/\r\n|\r/g, "\n").split("\n");
    if (content === "") lines.length = 0;
    const selected = lines.slice(offset - 1, input.limit ? offset - 1 + input.limit : undefined);
    const output = selected.join("\n");
    const truncation = truncateHead(output, {
      maxBytes: DEFAULT_MAX_BYTES,
      maxLines: DEFAULT_MAX_LINES,
    });
    const lineCount = output === "" ? 0 : truncation.outputLines;
    let text = truncation.content;
    if (truncation.truncated) {
      text += `\n\n[Showing ${lineCount} lines; use offset/limit to continue.]`;
    }
    const msg =
      lineCount === 0
        ? `读取 ${input.path} 文件 0 行`
        : `读取 ${input.path} 文件 ${offset}-${offset + lineCount - 1} 行`;
    return this.buildResponse([{ type: "text", text }], {
      msg,
      kind: "read",
      path: input.path,
      offset,
      lineCount,
      truncation: truncation.truncated ? truncation : undefined,
    });
  }
}

export function createReadTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof readSchema, ReadToolDetails> {
  return new ReadTool(options);
}
