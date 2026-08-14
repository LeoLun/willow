import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { resolvePlanDirectory } from "../utils/agent-paths.js";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { countLines, throwIfAborted, withMutationQueue } from "./shared.js";
import type { ToolRuntimeOptions, UpdatePlanToolDetails } from "./types.js";

const updatePlanSchema = Type.Object({
  fileName: Type.String({ description: "Existing Markdown plan filename, without a directory" }),
  content: Type.String({ description: "Complete replacement Markdown plan" }),
});

export type UpdatePlanToolInput = Static<typeof updatePlanSchema>;

function isSafePlanFileName(fileName: string): boolean {
  return (
    fileName === fileName.normalize("NFKC") &&
    basename(fileName) === fileName &&
    extname(fileName).toLowerCase() === ".md" &&
    /^[\p{Letter}\p{Number}._-]+\.md$/u.test(fileName)
  );
}

export class UpdatePlanTool extends ToolBase<typeof updatePlanSchema, UpdatePlanToolDetails> {
  readonly name = "updatePlan";
  readonly label = "updatePlan";
  readonly description =
    "Replace the complete content of an existing Markdown plan in the global plan directory.";
  readonly parameters = updatePlanSchema;
  override readonly executionMode = "sequential";

  protected override checkParams(input: UpdatePlanToolInput): Error | undefined {
    if (!isSafePlanFileName(input.fileName)) {
      return new Error("fileName must be a safe Markdown filename without a directory");
    }
    if (input.content.trim() === "") return new Error("content must be a non-empty string");
    return undefined;
  }

  protected override async run(
    context: ToolExecutionContext<UpdatePlanToolInput, UpdatePlanToolDetails>,
  ) {
    const { input, signal } = context;
    const path = join(resolvePlanDirectory(this.options.agentDir), input.fileName);

    return await withMutationQueue(path, async () => {
      throwIfAborted(signal);
      const handle = await open(path, constants.O_WRONLY | constants.O_NOFOLLOW);
      try {
        const stats = await handle.stat();
        if (!stats.isFile()) throw new Error(`${input.fileName} is not a regular file`);
        throwIfAborted(signal);
        await handle.truncate(0);
        await handle.writeFile(input.content, "utf8");
        throwIfAborted(signal);
      } finally {
        await handle.close();
      }

      const lineCount = countLines(input.content);
      const byteCount = Buffer.byteLength(input.content);
      return this.buildResponse(
        [{ type: "text", text: `Successfully updated the plan at ${path}` }],
        {
          msg: `更新计划 ${input.fileName}，共 ${lineCount} 行`,
          kind: "updatePlan",
          path,
          fileName: input.fileName,
          lineCount,
          byteCount,
        },
      );
    });
  }
}

export function createUpdatePlanTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof updatePlanSchema, UpdatePlanToolDetails> {
  return new UpdatePlanTool(options);
}
