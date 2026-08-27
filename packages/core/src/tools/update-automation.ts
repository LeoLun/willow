import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

export const UPDATE_AUTOMATION_TOOL_NAME = "updateAutomation" as const;

const modelConfigSchema = Type.Object(
  {
    providerId: Type.String({ minLength: 1 }),
    modelId: Type.String({ minLength: 1 }),
  },
  { additionalProperties: false },
);

export const updateAutomationSchema = Type.Object(
  {
    automationId: Type.Integer({ minimum: 1 }),
    title: Type.Optional(Type.String({ minLength: 1 })),
    prompt: Type.Optional(Type.String({ minLength: 1 })),
    cronExpression: Type.Optional(Type.String({ minLength: 1 })),
    timezone: Type.Optional(Type.String({ minLength: 1 })),
    status: Type.Optional(Type.Union([Type.Literal("enabled"), Type.Literal("disabled")])),
    model: Type.Optional(Type.Union([modelConfigSchema, Type.Null()])),
  },
  { additionalProperties: false },
);

export type UpdateAutomationToolInput = Static<typeof updateAutomationSchema>;

export type UpdateAutomationToolResult =
  | {
      ok: true;
      automationId: number;
      title: string;
      status: "enabled" | "disabled";
      cronExpression: string;
      timezone: string;
    }
  | { ok: false; error: string };

/** 由宿主注入：修改当前会话工作空间中的自动化。 */
export type UpdateAutomationHandler = (
  input: UpdateAutomationToolInput,
) => Promise<UpdateAutomationToolResult>;

export interface UpdateAutomationToolDetails extends BaseDetails {
  kind: "updateAutomation";
  automationId: number;
  title: string;
  status: "enabled" | "disabled";
  cronExpression: string;
  timezone: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export class UpdateAutomationTool extends ToolBase<
  typeof updateAutomationSchema,
  UpdateAutomationToolDetails
> {
  readonly name = UPDATE_AUTOMATION_TOOL_NAME;
  readonly label = "Update Automation";
  readonly description = `Update an existing scheduled automation in the current workspace. Use
listAutomations first if the automation ID is unknown. At least one field must be changed. Set model
to null to follow the user's default model. The change requires one-call permission review unless
full-access mode is active.`;
  readonly parameters = updateAutomationSchema;

  protected override checkParams(input: UpdateAutomationToolInput): Error | undefined {
    if (!Number.isInteger(input.automationId) || input.automationId <= 0) {
      return new Error("automationId must be a positive integer");
    }
    for (const [name, value] of [
      ["title", input.title],
      ["prompt", input.prompt],
      ["cronExpression", input.cronExpression],
      ["timezone", input.timezone],
    ] as const) {
      if (value !== undefined && !isNonEmptyString(value)) {
        return new Error(`${name} must be a non-empty string`);
      }
    }
    if (
      input.model !== undefined &&
      input.model !== null &&
      (!isNonEmptyString(input.model.providerId) || !isNonEmptyString(input.model.modelId))
    ) {
      return new Error("model must include non-empty providerId and modelId or be null");
    }
    if (
      input.title === undefined &&
      input.prompt === undefined &&
      input.cronExpression === undefined &&
      input.timezone === undefined &&
      input.status === undefined &&
      input.model === undefined
    ) {
      return new Error("at least one automation field must be provided");
    }
    return undefined;
  }

  protected override async run(
    context: ToolExecutionContext<UpdateAutomationToolInput, UpdateAutomationToolDetails>,
  ) {
    const handler = this.options.updateAutomation;
    if (!handler) {
      throw new Error("修改自动化在当前环境不可用。");
    }
    const result = await handler(context.input);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return this.buildResponse(
      [{ type: "text", text: `自动化已修改：${result.title}（ID ${result.automationId}）。` }],
      {
        kind: "updateAutomation",
        msg: `已修改自动化「${result.title}」`,
        automationId: result.automationId,
        title: result.title,
        status: result.status,
        cronExpression: result.cronExpression,
        timezone: result.timezone,
      },
    );
  }
}

export function createUpdateAutomationTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof updateAutomationSchema, UpdateAutomationToolDetails> {
  return new UpdateAutomationTool(options);
}
