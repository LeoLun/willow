import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import {
  authorizeMutation,
  countLines,
  resolveFromCwd,
  throwIfAborted,
  withMutationQueue,
} from "./shared.js";
import type { ToolRuntimeOptions, WriteToolDetails } from "./types.js";

const writeSchema = Type.Object({
  path: Type.String({ description: "Path to the file to write (relative or absolute)" }),
  content: Type.String({ description: "Content to write to the file" }),
});

export type WriteToolInput = Static<typeof writeSchema>;

export class WriteTool extends ToolBase<typeof writeSchema, WriteToolDetails> {
  readonly name = "write";
  readonly label = "write";
  readonly description = "Create or overwrite a UTF-8 file, creating parent directories.";
  readonly parameters = writeSchema;
  override readonly executionMode = "sequential";

  protected override async checkPermission(
    context: ToolExecutionContext<WriteToolInput, WriteToolDetails>,
  ): Promise<void> {
    await authorizeMutation({
      ...this.options,
      path: context.input.path,
      toolCallId: context.toolCallId,
      toolName: this.name,
      input: context.input,
      signal: context.signal,
    });
  }

  protected override async run(context: ToolExecutionContext<WriteToolInput, WriteToolDetails>) {
    const { input, signal } = context;
    const absolutePath = resolveFromCwd(this.options.cwd, input.path);
    return await withMutationQueue(absolutePath, async () => {
      throwIfAborted(signal);
      await mkdir(dirname(absolutePath), { recursive: true });
      throwIfAborted(signal);
      await writeFile(absolutePath, input.content, "utf8");
      throwIfAborted(signal);
      const lineCount = countLines(input.content);
      const byteCount = Buffer.byteLength(input.content);
      return this.buildResponse(
        [{ type: "text", text: `Successfully wrote ${lineCount} lines to ${input.path}` }],
        {
          msg: `写入 ${input.path} 文件 ${lineCount} 行`,
          kind: "write",
          path: input.path,
          lineCount,
          byteCount,
        },
      );
    });
  }
}

export function createWriteTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof writeSchema, WriteToolDetails> {
  return new WriteTool(options);
}
