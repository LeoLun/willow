import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { diffLines } from "diff";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { countLines, resolveFromCwd, throwIfAborted, withMutationQueue } from "./shared.js";
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

  protected override async run(context: ToolExecutionContext<WriteToolInput, WriteToolDetails>) {
    const { input, signal } = context;
    const absolutePath = resolveFromCwd(this.options.cwd, input.path);
    return await withMutationQueue(absolutePath, async () => {
      throwIfAborted(signal);
      const previousContent = await readFile(absolutePath, "utf8").catch((error: unknown) => {
        if (isMissingFileError(error)) return undefined;
        throw error;
      });
      throwIfAborted(signal);
      await mkdir(dirname(absolutePath), { recursive: true });
      throwIfAborted(signal);
      await writeFile(absolutePath, input.content, "utf8");
      throwIfAborted(signal);
      const changes = diffLines(normalizeLf(previousContent ?? ""), normalizeLf(input.content));
      const addedLines = changes
        .filter((change) => change.added)
        .reduce((total, change) => total + (change.count ?? countLines(change.value)), 0);
      const removedLines = changes
        .filter((change) => change.removed)
        .reduce((total, change) => total + (change.count ?? countLines(change.value)), 0);
      const lineCount = countLines(input.content);
      const byteCount = Buffer.byteLength(input.content);
      return this.buildResponse(
        [{ type: "text", text: `Successfully wrote ${lineCount} lines to ${input.path}` }],
        {
          msg: `写入 ${input.path} 文件 ${lineCount} 行`,
          kind: "write",
          path: input.path,
          created: previousContent === undefined,
          addedLines,
          removedLines,
          lineCount,
          byteCount,
        },
      );
    });
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

function normalizeLf(content: string): string {
  return content.replace(/\r\n|\r/g, "\n");
}

export function createWriteTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof writeSchema, WriteToolDetails> {
  return new WriteTool(options);
}
