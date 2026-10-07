import { Type, type Static } from "typebox";
import { validateMemoryUpdate } from "../memory/markdown.js";
import { updateMemory } from "../memory/storage.js";
import type { MemoryUpdateResult } from "../memory/types.js";
import { ToolBase, type ToolExecutionContext } from "./base.js";

const schema = Type.Object({
  scope: Type.Union([Type.Literal("global"), Type.Literal("project")]),
  section: Type.String(),
  oldText: Type.Optional(Type.String()),
  newText: Type.String(),
});
export type MemoryUpdateToolInput = Static<typeof schema>;
export interface MemoryUpdateToolDetails extends MemoryUpdateResult {
  kind: "memory_update";
  msg: string;
}
export class MemoryUpdateTool extends ToolBase<typeof schema, MemoryUpdateToolDetails> {
  readonly name = "memory_update";
  readonly label = "memory_update";
  readonly description =
    "Persist durable global or project memory. Append newText to a section, or replace a unique exact oldText in that section. Use empty newText with oldText to delete outdated memory. Never store secrets or temporary task state.";
  readonly parameters = schema;
  override readonly executionMode = "sequential";
  protected override checkParams(input: MemoryUpdateToolInput): Error | undefined {
    try {
      validateMemoryUpdate(input);
    } catch (error) {
      return error as Error;
    }
    if (this.options.agentMode === "plan") return new Error("Memory is read-only in plan mode");
    if (input.scope === "project" && !this.options.projectTrusted)
      return new Error("Project memory requires a trusted workspace");
    return undefined;
  }
  protected override async run(
    context: ToolExecutionContext<MemoryUpdateToolInput, MemoryUpdateToolDetails>,
  ) {
    const result = await updateMemory(this.options, context.input, context.signal);
    const msg = result.changed ? "Memory updated." : "Memory already exists.";
    return this.buildResponse([{ type: "text", text: msg }], {
      ...result,
      kind: "memory_update",
      msg,
    });
  }
}
