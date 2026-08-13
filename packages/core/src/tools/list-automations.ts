import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

export const LIST_AUTOMATIONS_TOOL_NAME = "listAutomations" as const;

export const listAutomationsSchema = Type.Object({}, { additionalProperties: false });

export type ListAutomationsToolInput = Static<typeof listAutomationsSchema>;

export type AutomationToolItem = {
  automationId: number;
  title: string;
  prompt: string;
  status: "enabled" | "disabled";
  cronExpression: string;
  timezone: string;
  model?: {
    providerId: string;
    modelId: string;
  };
};

export type ListAutomationsToolResult =
  | { ok: true; automations: AutomationToolItem[] }
  | { ok: false; error: string };

/** 由宿主注入：列出当前会话工作空间中的自动化。 */
export type ListAutomationsHandler = (
  input: ListAutomationsToolInput,
) => Promise<ListAutomationsToolResult>;

export interface ListAutomationsToolDetails extends BaseDetails {
  kind: "listAutomations";
  automationCount: number;
  automations: AutomationToolItem[];
}

export class ListAutomationsTool extends ToolBase<
  typeof listAutomationsSchema,
  ListAutomationsToolDetails
> {
  readonly name = LIST_AUTOMATIONS_TOOL_NAME;
  readonly label = "List Automations";
  readonly description = `List the scheduled automations in the current workspace. Use this tool
before updating or deleting an automation when its numeric ID is not already known. The result
includes each automation's title, prompt, schedule, timezone, status, and model configuration.`;
  readonly parameters = listAutomationsSchema;

  protected override async run(
    context: ToolExecutionContext<ListAutomationsToolInput, ListAutomationsToolDetails>,
  ) {
    const handler = this.options.listAutomations;
    if (!handler) {
      throw new Error("读取自动化列表在当前环境不可用。");
    }
    const result = await handler(context.input);
    if (!result.ok) {
      throw new Error(result.error);
    }
    const text =
      result.automations.length === 0
        ? "当前工作空间没有自动化。"
        : JSON.stringify(result.automations, null, 2);
    return this.buildResponse([{ type: "text", text }], {
      kind: "listAutomations",
      msg: `已读取 ${result.automations.length} 条自动化`,
      automationCount: result.automations.length,
      automations: result.automations,
    });
  }
}

export function createListAutomationsTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof listAutomationsSchema, ListAutomationsToolDetails> {
  return new ListAutomationsTool(options);
}
