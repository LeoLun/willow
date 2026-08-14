import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { resolvePlanDirectory } from "../utils/agent-paths.js";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { countLines, throwIfAborted, withMutationQueue } from "./shared.js";
import type { ToolRuntimeOptions, WritePlanToolDetails } from "./types.js";

const writePlanSchema = Type.Object({
  name: Type.String({ description: "Short descriptive name used to generate the plan filename" }),
  content: Type.String({ description: "Complete Markdown implementation plan" }),
});

export type WritePlanToolInput = Static<typeof writePlanSchema>;

function slugifyPlanName(name: string): string {
  const slug = name
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase("en-US")
    .replace(/[\\/]+/g, "-")
    .replace(/[^\p{Letter}\p{Number}-]+/gu, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
    .replace(/-$/g, "");
  return slug || "plan";
}

function currentDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function isFileExistsError(error: unknown): boolean {
  return (
    error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "EEXIST"
  );
}

export class WritePlanTool extends ToolBase<typeof writePlanSchema, WritePlanToolDetails> {
  readonly name = "writePlan";
  readonly label = "writePlan";
  readonly description =
    "Create a new Markdown implementation plan in the global plan directory without overwriting existing plans.";
  readonly parameters = writePlanSchema;
  override readonly executionMode = "sequential";

  protected override checkParams(input: WritePlanToolInput): Error | undefined {
    if (input.name.trim() === "") return new Error("name must be a non-empty string");
    if (input.content.trim() === "") return new Error("content must be a non-empty string");
    return undefined;
  }

  protected override async run(
    context: ToolExecutionContext<WritePlanToolInput, WritePlanToolDetails>,
  ) {
    const { input, signal } = context;
    const planDirectory = resolvePlanDirectory(this.options.agentDir);
    const baseName = `${currentDate()}-${slugifyPlanName(input.name)}`;

    return await withMutationQueue(planDirectory, async () => {
      throwIfAborted(signal);
      await mkdir(planDirectory, { recursive: true });

      for (let suffix = 1; ; suffix += 1) {
        throwIfAborted(signal);
        const fileName = `${baseName}${suffix === 1 ? "" : `-${suffix}`}.md`;
        const path = join(planDirectory, fileName);
        try {
          await writeFile(path, input.content, { encoding: "utf8", flag: "wx" });
          throwIfAborted(signal);
          const lineCount = countLines(input.content);
          const byteCount = Buffer.byteLength(input.content);
          return this.buildResponse(
            [{ type: "text", text: `Successfully saved the plan to ${path}` }],
            {
              msg: `保存计划 ${fileName}，共 ${lineCount} 行`,
              kind: "writePlan",
              path,
              fileName,
              lineCount,
              byteCount,
            },
          );
        } catch (error) {
          if (isFileExistsError(error)) continue;
          throw error;
        }
      }
    });
  }
}

export function createWritePlanTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof writePlanSchema, WritePlanToolDetails> {
  return new WritePlanTool(options);
}
