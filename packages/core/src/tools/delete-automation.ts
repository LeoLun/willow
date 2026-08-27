import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

export const DELETE_AUTOMATION_TOOL_NAME = "deleteAutomation" as const;

export const deleteAutomationSchema = Type.Object(
  {
    automationId: Type.Integer({ minimum: 1 }),
  },
  { additionalProperties: false },
);

export type DeleteAutomationToolInput = Static<typeof deleteAutomationSchema>;

export type DeleteAutomationToolResult =
  | { ok: true; automationId: number; title: string }
  | { ok: false; error: string };

/** 由宿主注入：删除当前会话工作空间中的自动化。 */
export type DeleteAutomationHandler = (
  input: DeleteAutomationToolInput,
) => Promise<DeleteAutomationToolResult>;

export interface DeleteAutomationToolDetails extends BaseDetails {
  kind: "deleteAutomation";
  automationId: number;
  title: string;
}

export class DeleteAutomationTool extends ToolBase<
  typeof deleteAutomationSchema,
  DeleteAutomationToolDetails
> {
  readonly name = DELETE_AUTOMATION_TOOL_NAME;
  readonly label = "Delete Automation";
  readonly description = `Delete a scheduled automation in the current workspace. Use
listAutomations first if the automation ID is unknown. Deleting removes its trigger and run history,
while preserving chat sessions created by previous runs. Deletion requires one-call permission
review unless full-access mode is active.`;
  readonly parameters = deleteAutomationSchema;

  protected override checkParams(input: DeleteAutomationToolInput): Error | undefined {
    return Number.isInteger(input.automationId) && input.automationId > 0
      ? undefined
      : new Error("automationId must be a positive integer");
  }

  protected override async run(
    context: ToolExecutionContext<DeleteAutomationToolInput, DeleteAutomationToolDetails>,
  ) {
    const handler = this.options.deleteAutomation;
    if (!handler) {
      throw new Error("删除自动化在当前环境不可用。");
    }
    const result = await handler(context.input);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return this.buildResponse(
      [{ type: "text", text: `自动化已删除：${result.title}（ID ${result.automationId}）。` }],
      {
        kind: "deleteAutomation",
        msg: `已删除自动化「${result.title}」`,
        automationId: result.automationId,
        title: result.title,
      },
    );
  }
}

export function createDeleteAutomationTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof deleteAutomationSchema, DeleteAutomationToolDetails> {
  return new DeleteAutomationTool(options);
}
