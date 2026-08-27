import { readdir } from "node:fs/promises";
import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import { resolveFromCwd, throwIfAborted } from "./shared.js";
import type { LsToolDetails, ToolRuntimeOptions } from "./types.js";

const lsSchema = Type.Object({
  path: Type.Optional(
    Type.String({
      description: "Directory to list (default: current directory)",
    }),
  ),
});

export type LsToolInput = Static<typeof lsSchema>;

export class LsTool extends ToolBase<typeof lsSchema, LsToolDetails> {
  readonly name = "ls";
  readonly label = "ls";
  readonly description = "List the direct children of a directory.";
  readonly parameters = lsSchema;

  protected override async run(context: ToolExecutionContext<LsToolInput, LsToolDetails>) {
    const { input, signal } = context;
    const path = input.path || ".";
    throwIfAborted(signal);
    const entries = await readdir(resolveFromCwd(this.options.cwd, path), {
      withFileTypes: true,
    });
    throwIfAborted(signal);
    entries.sort((left, right) => {
      if (left.isDirectory() !== right.isDirectory()) return left.isDirectory() ? -1 : 1;
      return left.name.localeCompare(right.name);
    });
    const output = entries
      .map((entry) => `${entry.name}${entry.isDirectory() ? "/" : ""}`)
      .join("\n");
    return this.buildResponse([{ type: "text", text: output || "(empty directory)" }], {
      msg: `列出 ${path} 目录，共 ${entries.length} 项`,
      kind: "ls",
      path,
      entryCount: entries.length,
    });
  }
}

export function createLsTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof lsSchema, LsToolDetails> {
  return new LsTool(options);
}
