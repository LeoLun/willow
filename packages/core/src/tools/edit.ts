import { readFile, writeFile } from "node:fs/promises";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { createPatch, diffLines } from "diff";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import {
  authorizeMutation,
  countLines,
  resolveFromCwd,
  throwIfAborted,
  withMutationQueue,
} from "./shared.js";
import type { EditToolDetails, ToolRuntimeOptions } from "./types.js";

const replacementSchema = Type.Object({
  oldText: Type.String({ description: "Unique exact text to replace" }),
  newText: Type.String({ description: "Replacement text" }),
});

const editSchema = Type.Object({
  path: Type.String({ description: "Path to the file to edit (relative or absolute)" }),
  edits: Type.Array(replacementSchema, { minItems: 1 }),
});

export type EditToolInput = Static<typeof editSchema>;

function normalizeLf(content: string): string {
  return content.replace(/\r\n|\r/g, "\n");
}

function restoreLineEndings(content: string, ending: string): string {
  return ending === "\n" ? content : content.replace(/\n/g, ending);
}

export class EditTool extends ToolBase<typeof editSchema, EditToolDetails> {
  readonly name = "edit";
  readonly label = "edit";
  readonly description = "Edit one file with unique, non-overlapping exact text replacements.";
  readonly parameters = editSchema;
  override readonly executionMode = "sequential";

  protected override checkParams(input: EditToolInput): Error | undefined {
    if (input.edits.some((edit) => edit.oldText === "")) {
      return new Error("oldText must not be empty");
    }
    return undefined;
  }

  protected override async checkPermission(
    context: ToolExecutionContext<EditToolInput, EditToolDetails>,
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

  protected override async run(context: ToolExecutionContext<EditToolInput, EditToolDetails>) {
    const { input, signal } = context;
    const absolutePath = resolveFromCwd(this.options.cwd, input.path);
    return await withMutationQueue(absolutePath, async () => {
      throwIfAborted(signal);
      const rawContent = await readFile(absolutePath, "utf8");
      throwIfAborted(signal);
      const bom = rawContent.startsWith("\uFEFF") ? "\uFEFF" : "";
      const withoutBom = bom ? rawContent.slice(1) : rawContent;
      const ending = withoutBom.includes("\r\n") ? "\r\n" : withoutBom.includes("\r") ? "\r" : "\n";
      const original = normalizeLf(withoutBom);
      const replacements = input.edits.map((edit) => ({
        oldText: normalizeLf(edit.oldText),
        newText: normalizeLf(edit.newText),
      }));
      const ranges = replacements.map((edit) => {
        const start = original.indexOf(edit.oldText);
        if (start < 0) throw new Error("oldText was not found in the original file");
        if (original.indexOf(edit.oldText, start + 1) >= 0) {
          throw new Error("oldText must match exactly one location");
        }
        return { ...edit, start, end: start + edit.oldText.length };
      });
      ranges.sort((left, right) => left.start - right.start);
      for (let index = 1; index < ranges.length; index += 1) {
        if (ranges[index].start < ranges[index - 1].end) {
          throw new Error("Edit ranges must not overlap");
        }
      }
      let updated = original;
      for (const range of [...ranges].reverse()) {
        updated = updated.slice(0, range.start) + range.newText + updated.slice(range.end);
      }
      const changes = diffLines(original, updated);
      const addedLines = changes
        .filter((change) => change.added)
        .reduce((total, change) => total + (change.count ?? countLines(change.value)), 0);
      const removedLines = changes
        .filter((change) => change.removed)
        .reduce((total, change) => total + (change.count ?? countLines(change.value)), 0);
      const diff = createPatch(input.path, original, updated, "", "");
      await writeFile(absolutePath, bom + restoreLineEndings(updated, ending), "utf8");
      throwIfAborted(signal);
      return this.buildResponse(
        [
          {
            type: "text",
            text: `Successfully edited ${input.path} (+${addedLines} -${removedLines})`,
          },
        ],
        {
          msg: `修改 ${input.path} 文件 +${addedLines} -${removedLines}`,
          kind: "edit",
          path: input.path,
          addedLines,
          removedLines,
          diff,
        },
      );
    });
  }
}

export function createEditTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof editSchema, EditToolDetails> {
  return new EditTool(options);
}
