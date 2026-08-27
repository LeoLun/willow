import type { AgentTool } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

export const CREATE_AUTOMATION_TOOL_NAME = "createAutomation" as const;

const modelConfigSchema = Type.Object({
  providerId: Type.String({
    minLength: 1,
    description: "Provider id of a configured model.",
  }),
  modelId: Type.String({
    minLength: 1,
    description: "Model id within the provider.",
  }),
});

export const createAutomationSchema = Type.Object({
  title: Type.Optional(
    Type.String({
      description: "Optional human-readable name. When omitted, one is derived from the prompt.",
    }),
  ),
  prompt: Type.String({
    minLength: 1,
    description:
      "The task prompt that Willow will run unattended on the schedule in the current workspace.",
  }),
  cronExpression: Type.String({
    minLength: 1,
    description:
      'Five-segment cron expression in the order: minute hour day-of-month month day-of-week, for example "0 9 * * 1-5".',
  }),
  timezone: Type.Optional(
    Type.String({
      description:
        'IANA timezone identifier such as "Asia/Shanghai". Defaults to the user\'s system timezone.',
    }),
  ),
  model: Type.Optional(modelConfigSchema),
});

export type CreateAutomationToolInput = Static<typeof createAutomationSchema>;

export type CreateAutomationToolResult =
  | {
      ok: true;
      automationId: number;
      title: string;
      cronExpression: string;
    }
  | { ok: false; error: string };

/** 由宿主注入：在当前会话工作空间中创建并启用一条定时自动化。 */
export type CreateAutomationHandler = (
  input: CreateAutomationToolInput,
) => Promise<CreateAutomationToolResult>;

export interface CreateAutomationToolDetails extends BaseDetails {
  kind: "createAutomation";
  automationId: number;
  title: string;
  cronExpression: string;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim() !== "";
}

export class CreateAutomationTool extends ToolBase<
  typeof createAutomationSchema,
  CreateAutomationToolDetails
> {
  readonly name = CREATE_AUTOMATION_TOOL_NAME;
  readonly label = "Create Automation";
  readonly description = `Use this tool to create a scheduled automation that Willow runs unattended in the
current workspace. Use it only when the user explicitly asks to set up a recurring, scheduled,
or periodic task.

The cronExpression must contain exactly five segments in this order: minute hour day-of-month
month day-of-week. Examples:
- "0 9 * * *" runs daily at 09:00.
- "0 * * * *" runs every hour.
- "30 18 * * 1,3,5" runs every Monday, Wednesday, and Friday at 18:30.
- "0 9 * * 1-5" runs every weekday at 09:00.

Rules and constraints:
- The automation always runs in the current workspace with its own new session.
- The prompt runs unattended: tool approvals use the AI reviewer and cannot ask the user.
- When timezone is omitted, the user's system timezone is recorded.
- When model is omitted, the automation follows the user's default model at run time.
- Creating the automation requires one-call permission review unless full-access mode is active.`;
  readonly parameters = createAutomationSchema;

  constructor(options: ToolRuntimeOptions) {
    super(options);
  }

  protected override checkParams(input: CreateAutomationToolInput): Error | undefined {
    if (!isNonEmptyString(input.prompt)) {
      return new Error("prompt must be a non-empty string");
    }
    if (!isNonEmptyString(input.cronExpression)) {
      return new Error("cronExpression must be a non-empty string");
    }
    if (input.title !== undefined && !isNonEmptyString(input.title)) {
      return new Error("title must be a non-empty string");
    }
    if (input.timezone !== undefined && !isNonEmptyString(input.timezone)) {
      return new Error("timezone must be a non-empty string");
    }
    if (
      input.model !== undefined &&
      (!isNonEmptyString(input.model.providerId) || !isNonEmptyString(input.model.modelId))
    ) {
      return new Error("model must include non-empty providerId and modelId");
    }
    return undefined;
  }

  protected override async run(
    context: ToolExecutionContext<CreateAutomationToolInput, CreateAutomationToolDetails>,
  ) {
    const handler = this.options.createAutomation;
    if (!handler) {
      throw new Error("创建定时任务在当前环境不可用。");
    }
    const result = await handler(context.input);
    if (!result.ok) {
      throw new Error(result.error);
    }
    return this.buildResponse(
      [
        {
          type: "text",
          text: `定时任务已创建：${result.title}（${result.cronExpression}），自动化 ID ${result.automationId}。`,
        },
      ],
      {
        kind: "createAutomation",
        msg: `已创建定时任务「${result.title}」`,
        automationId: result.automationId,
        title: result.title,
        cronExpression: result.cronExpression,
      },
    );
  }
}

export function createCreateAutomationTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof createAutomationSchema, CreateAutomationToolDetails> {
  return new CreateAutomationTool(options);
}
