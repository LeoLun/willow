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

const PREVIEW_LENGTH = 80;
const CLOSEST_LINE_THRESHOLD = 0.45;

function previewText(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > PREVIEW_LENGTH ? `${collapsed.slice(0, PREVIEW_LENGTH)}…` : collapsed;
}

function bigrams(text: string): Set<string> {
  const normalized = previewText(text);
  const result = new Set<string>();
  for (let index = 0; index < normalized.length - 1; index += 1) {
    result.add(normalized.slice(index, index + 2));
  }
  return result;
}

function lineSimilarity(left: string, right: string): number {
  if (left === right) return 1;
  const leftBigrams = bigrams(left);
  const rightBigrams = bigrams(right);
  if (leftBigrams.size === 0 || rightBigrams.size === 0) return 0;
  let intersection = 0;
  for (const pair of leftBigrams) {
    if (rightBigrams.has(pair)) intersection += 1;
  }
  return (2 * intersection) / (leftBigrams.size + rightBigrams.size);
}

function closestLine(
  oldText: string,
  content: string,
): { lineNumber: number; text: string } | undefined {
  const key = oldText
    .split("\n")
    .map((line) => line.trim())
    .find(Boolean);
  if (!key) return undefined;

  let best: { lineNumber: number; text: string; score: number } | undefined;
  for (const [index, text] of content.split("\n").entries()) {
    if (text.trim() === "") continue;
    const score = lineSimilarity(key, text.trim());
    if (!best || score > best.score) best = { lineNumber: index + 1, text, score };
  }
  return best && best.score >= CLOSEST_LINE_THRESHOLD ? best : undefined;
}

function oldTextNotFoundError(editIndex: number, oldText: string, content: string): Error {
  let message =
    `oldText was not found in the original file at edits[${editIndex}]: ` +
    `"${previewText(oldText)}".`;
  const suggestion = closestLine(oldText, content);
  if (suggestion) {
    message +=
      ` Closest current line is ${suggestion.lineNumber}: ` + `"${previewText(suggestion.text)}".`;
  }
  message +=
    " Re-read this file and retry with its exact current text; all edits must target this path.";
  return new Error(message);
}

export class EditTool extends ToolBase<typeof editSchema, EditToolDetails> {
  readonly name = "edit";
  readonly label = "edit";
  readonly description =
    "Edit one file with unique, non-overlapping exact text replacements. Copy oldText from the " +
    "file's current content; every edit must target this path and the whole call fails atomically " +
    "if any oldText is missing.";
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
      const ranges = replacements.map((edit, editIndex) => {
        const start = original.indexOf(edit.oldText);
        if (start < 0) throw oldTextNotFoundError(editIndex, edit.oldText, original);
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
