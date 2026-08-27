import { randomUUID } from "node:crypto";
import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
  ToolExecutionMode,
} from "@earendil-works/pi-agent-core";
import type { Static, TSchema } from "typebox";
import { Errors } from "typebox/value";
import { EscalationStore } from "./escalation-store.js";
import { DefaultPermissionEngine } from "./permission-engine.js";
import { normalizeApprovalAction } from "./permission-engine.js";
import { throwIfAborted } from "./shared.js";
import type {
  ApprovalAction,
  BaseDetails,
  PermissionDecision,
  PermissionMode,
  ToolApprovalReason,
  ToolName,
  ToolRuntimeOptions,
} from "./types.js";

export type ToolExecutionContext<TInput, TDetails> = {
  toolCallId: string;
  input: TInput;
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<TDetails>;
  permissionMode: PermissionMode;
  approvalAction: ApprovalAction;
  permissionDecision: PermissionDecision;
};

export abstract class ToolBase<
  TParameters extends TSchema,
  TDetails extends BaseDetails,
> implements AgentTool<TParameters, TDetails> {
  abstract readonly name: ToolName;
  abstract readonly label: string;
  abstract readonly description: string;
  abstract readonly parameters: TParameters;
  readonly executionMode?: ToolExecutionMode;

  protected readonly options: ToolRuntimeOptions &
    Required<Pick<ToolRuntimeOptions, "sessionId" | "permissionEngine" | "escalationStore">>;

  constructor(options: ToolRuntimeOptions) {
    const sessionId = options.sessionId ?? `standalone:${randomUUID()}`;
    this.options = {
      ...options,
      sessionId,
      permissionEngine: options.permissionEngine ?? new DefaultPermissionEngine(),
      escalationStore: options.escalationStore ?? new EscalationStore(sessionId),
    };
    // @TODO 构建工作空间及副作用区域
  }

  async execute(
    toolCallId: string,
    input: Static<TParameters>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<TDetails>,
  ): Promise<AgentToolResult<TDetails>> {
    const startedAt = Date.now();
    let executionContext: ToolExecutionContext<Static<TParameters>, TDetails> | undefined;
    try {
      throwIfAborted(signal);
      this.validateSchema(input);
      const paramsError = this.checkParams(input);
      if (paramsError) throw paramsError;

      const context: ToolExecutionContext<Static<TParameters>, TDetails> = {
        toolCallId,
        input,
        signal,
        onUpdate,
        permissionMode: this.options.getPermissionMode?.() ?? this.options.permissionMode,
        approvalAction: normalizeApprovalAction(
          this.name,
          input as Record<string, unknown>,
          this.options,
        ),
        permissionDecision: undefined as never,
      };
      executionContext = context;
      context.permissionDecision = await this.options.permissionEngine.evaluate({
        sessionId: this.options.sessionId,
        toolCallId,
        toolName: this.name,
        input: input as Record<string, unknown>,
        workspaceRoot: this.options.cwd,
        action: context.approvalAction,
        sandboxPolicy: this.options.sandboxPolicy,
        agentDir: this.options.agentDir,
      });
      await this.options.permissionEventSink?.({
        type: "decision",
        sessionId: this.options.sessionId,
        toolCallId,
        toolName: this.name,
        permissionMode: context.permissionMode,
        action: context.approvalAction,
        decision: context.permissionDecision,
      });
      await this.preAuthorize(context);
      await this.authorizeDecision(context);
      await this.checkPermission(context);
      throwIfAborted(signal);
      const result = await this.run(context);
      await this.options.permissionEventSink?.({
        type: "execution",
        sessionId: this.options.sessionId,
        toolCallId,
        toolName: this.name,
        outcome: "succeeded",
        durationMs: Date.now() - startedAt,
      });
      return result;
    } catch (error) {
      await this.options.permissionEventSink?.({
        type: "execution",
        sessionId: this.options.sessionId,
        toolCallId,
        toolName: this.name,
        outcome: "failed",
        durationMs: Date.now() - startedAt,
        error: error instanceof Error ? error.message : String(error),
      });
      return this.buildError(error);
    } finally {
      if (executionContext) await this.finalize(executionContext);
    }
  }

  // 检查参数是否合法
  protected checkParams(_input: Static<TParameters>): Error | undefined {
    return undefined;
  }

  // 检查权限是否合法
  protected async checkPermission(
    _context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<void> {}

  /** Validate call-bound capabilities before any approval UI is shown. */
  protected async preAuthorize(
    _context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<void> {}

  protected async finalize(
    _context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<void> {}

  // 执行工具
  protected abstract run(
    context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<AgentToolResult<TDetails>>;

  // 构建响应
  protected buildResponse(
    content: AgentToolResult<TDetails>["content"],
    details: TDetails,
  ): AgentToolResult<TDetails> {
    return { content, details };
  }

  protected buildError(error: unknown): never {
    throw error instanceof Error ? error : new Error(String(error));
  }

  protected async requestPermission(
    context: ToolExecutionContext<Static<TParameters>, TDetails>,
    request: {
      reason: ToolApprovalReason;
      display: string;
      mayHavePartialEffects?: boolean;
    },
  ): Promise<void> {
    if (context.signal?.aborted) throw new Error("Operation aborted");
    const decision = this.options.requestApproval
      ? await this.options.requestApproval(
          {
            toolCallId: context.toolCallId,
            toolName: this.name,
            input: context.input as Record<string, unknown>,
            permissionMode: context.permissionMode,
            action: context.approvalAction,
            risk: context.permissionDecision.risk,
            ruleId: context.permissionDecision.ruleId,
            approvalReason: context.permissionDecision.reason,
            autoReviewable: context.permissionDecision.autoReviewable,
            requestedPermissions: context.permissionDecision.requestedPermissions,
            ...request,
          },
          context.signal,
        )
      : "deny";
    await this.options.permissionEventSink?.({
      type: "approval",
      sessionId: this.options.sessionId,
      toolCallId: context.toolCallId,
      decision,
    });
    if (context.signal?.aborted) throw new Error("Operation aborted");
    if (decision !== "allow") throw new Error(`Permission denied for ${this.name}`);
  }

  private async authorizeDecision(
    context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<void> {
    const decision = context.permissionDecision;
    if (decision.action === "deny") {
      throw new Error(`Permission denied for ${this.name}: ${decision.reason.message}`);
    }
    if (
      decision.action === "allow" ||
      (context.permissionMode === "full-access" && decision.ruleId !== "bash.sandbox-escalation")
    ) {
      return;
    }
    await this.requestPermission(context, {
      reason: legacyApprovalReason(this.name, decision.ruleId),
      display: approvalDisplay(context.approvalAction),
    });
  }

  private validateSchema(input: unknown): void {
    const error = Errors(this.parameters, input)[0];
    if (!error) return;
    const path = error.instancePath || "/";
    throw new Error(`Invalid parameters for ${this.name}: ${path} ${error.message}`);
  }
}

function approvalDisplay(action: ApprovalAction): string {
  switch (action.type) {
    case "exec":
      return action.command;
    case "filesystem":
      return action.paths.join("\n");
    case "network":
      return action.url;
    case "automation":
      return JSON.stringify(action.input);
    case "internal":
      return action.capability;
  }
}

function legacyApprovalReason(toolName: ToolName, ruleId: string): ToolApprovalReason {
  if (ruleId === "bash.sandbox-escalation") return "sandbox-denied";
  if (ruleId === "bash.interactive-terminal") return "interactive-terminal";
  if (toolName === "createAutomation") return "automation-create";
  if (toolName === "updateAutomation") return "automation-update";
  if (toolName === "deleteAutomation") return "automation-delete";
  if (ruleId.includes("outside-workspace-read")) return "outside-workspace-read";
  if (ruleId.includes("outside-workspace-write")) return "outside-workspace-write";
  return "command-risk";
}
