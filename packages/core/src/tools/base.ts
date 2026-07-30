import type {
  AgentTool,
  AgentToolResult,
  AgentToolUpdateCallback,
  ToolExecutionMode,
} from "@earendil-works/pi-agent-core";
import type { Static, TSchema } from "typebox";
import { Errors } from "typebox/value";
import { authorize, throwIfAborted } from "./shared.js";
import type { BaseDetails, ToolApprovalReason, ToolName, ToolRuntimeOptions } from "./types.js";

export type ToolExecutionContext<TInput, TDetails> = {
  toolCallId: string;
  input: TInput;
  signal?: AbortSignal;
  onUpdate?: AgentToolUpdateCallback<TDetails>;
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

  constructor(protected readonly options: ToolRuntimeOptions) {}

  async execute(
    toolCallId: string,
    input: Static<TParameters>,
    signal?: AbortSignal,
    onUpdate?: AgentToolUpdateCallback<TDetails>,
  ): Promise<AgentToolResult<TDetails>> {
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
      };
      await this.checkPermission(context);
      throwIfAborted(signal);
      return await this.run(context);
    } catch (error) {
      return this.buildError(error);
    }
  }

  protected checkParams(_input: Static<TParameters>): Error | undefined {
    return undefined;
  }

  protected async checkPermission(
    _context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<void> {}

  protected abstract run(
    context: ToolExecutionContext<Static<TParameters>, TDetails>,
  ): Promise<AgentToolResult<TDetails>>;

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
    await authorize(
      this.options.permissionMode,
      this.options.requestApproval,
      {
        toolCallId: context.toolCallId,
        toolName: this.name,
        input: context.input as Record<string, unknown>,
        ...request,
      },
      context.signal,
    );
  }

  private validateSchema(input: unknown): void {
    const error = Errors(this.parameters, input)[0];
    if (!error) return;
    const path = error.instancePath || "/";
    throw new Error(`Invalid parameters for ${this.name}: ${path} ${error.message}`);
  }
}
