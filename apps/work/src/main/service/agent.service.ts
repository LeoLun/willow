import {
  AgentHarness,
  InMemorySessionRepo,
  type AgentHarnessEvent,
  type SessionMetadata,
} from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import type { AssistantMessage, Model, MutableModels } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import {
  AgentCore,
  type AgentMode,
  type AgentCoreOptions,
  type AgentHarnessOptions,
  type AskUserHandler,
  type CreateAutomationToolInput,
  type CreateAutomationToolResult,
  type DeleteAutomationToolInput,
  type DeleteAutomationToolResult,
  type ListAutomationsToolInput,
  type ListAutomationsToolResult,
  type ToolApprovalHandler,
  type UpdateAutomationToolInput,
  type UpdateAutomationToolResult,
} from "@willow/core";
import { Injectable } from "@willow/poetry";
import type { StatisticsRunSource } from "../db/schema";
import { BuiltinSkillService } from "./builtin-skill.service";
import { CredentialService } from "./credential.service";
import { SessionManagerFactory } from "./session-manager.factory";
import { StatisticsService } from "./statistics.service";
import { TAVILY_CREDENTIAL_ID } from "./tavily.service";

type AgentServiceOptions = Omit<AgentCoreOptions, "models" | "sessionRepo" | "tavilyApiKey"> & {
  workspaceId: number;
  model: Model<any>;
  metadata: SessionMetadata;
  agentMode?: AgentMode;
  permissionMode: import("@willow/core").PermissionMode;
  requestApproval: ToolApprovalHandler;
  requestUser: AskUserHandler;
  sandboxPolicy?: AgentHarnessOptions["sandboxPolicy"];
};

type SimpleAgentOptions = {
  cwd: string;
  model: Model<any>;
  systemPrompt: string;
  workspaceId: number;
  sessionId: string;
  source: Extract<StatisticsRunSource, "approval" | "title">;
};

/** 创建定时自动化工具的主进程实现：按工作空间创建并启用一条自动化。 */
export type WorkspaceCreateAutomationHandler = (
  workspaceId: number,
  input: CreateAutomationToolInput,
) => Promise<CreateAutomationToolResult>;

export type WorkspaceListAutomationsHandler = (
  workspaceId: number,
  input: ListAutomationsToolInput,
) => Promise<ListAutomationsToolResult>;

export type WorkspaceUpdateAutomationHandler = (
  workspaceId: number,
  input: UpdateAutomationToolInput,
) => Promise<UpdateAutomationToolResult>;

export type WorkspaceDeleteAutomationHandler = (
  workspaceId: number,
  input: DeleteAutomationToolInput,
) => Promise<DeleteAutomationToolResult>;

type StatisticsInterceptorOptions = {
  source: StatisticsRunSource;
  workspaceId: number;
  sessionId: string;
};

/**
 * 用于创建 Agent 对象的服务
 */
@Injectable()
export class AgentService {
  private models: MutableModels;
  private listAutomationsHandler?: WorkspaceListAutomationsHandler;
  private createAutomationHandler?: WorkspaceCreateAutomationHandler;
  private updateAutomationHandler?: WorkspaceUpdateAutomationHandler;
  private deleteAutomationHandler?: WorkspaceDeleteAutomationHandler;

  constructor(
    private readonly credentialService: CredentialService,
    private readonly sessionManagerFactory: SessionManagerFactory,
    private readonly statisticsService: StatisticsService,
    private readonly builtinSkillService: BuiltinSkillService,
  ) {
    const credentialStore = this.credentialService.getCredentialStore();
    this.models = builtinModels({ credentials: credentialStore });
  }

  getModels() {
    return this.models;
  }

  /** 注入 createAutomation 工具的实现，供 AI 在对话中创建定时自动化。 */
  setCreateAutomationHandler(handler: WorkspaceCreateAutomationHandler): void {
    this.createAutomationHandler = handler;
  }

  setListAutomationsHandler(handler: WorkspaceListAutomationsHandler): void {
    this.listAutomationsHandler = handler;
  }

  setUpdateAutomationHandler(handler: WorkspaceUpdateAutomationHandler): void {
    this.updateAutomationHandler = handler;
  }

  setDeleteAutomationHandler(handler: WorkspaceDeleteAutomationHandler): void {
    this.deleteAutomationHandler = handler;
  }

  getModel(providerId: string, modelId: string): Model<any> {
    const model = this.models.getModel(providerId, modelId);
    if (!model) {
      throw new Error(`Unsupported model: ${providerId}/${modelId}`);
    }
    return model;
  }

  async getSimpleAgent(options: SimpleAgentOptions) {
    const session = await new InMemorySessionRepo().create();
    const harness = new AgentHarness({
      models: this.models,
      env: new NodeExecutionEnv({ cwd: options.cwd }),
      session,
      model: options.model,
      systemPrompt: options.systemPrompt,
      tools: [],
      thinkingLevel: "off",
    });
    return this.interceptStatistics(harness, {
      source: options.source,
      workspaceId: options.workspaceId,
      sessionId: options.sessionId,
    });
  }

  // 获取完整的AgentHarness，用于执行复杂任务，会记录上下文到数据库
  async getAgentHarness({
    workspaceId,
    model,
    metadata,
    agentMode,
    permissionMode,
    requestApproval,
    requestUser,
    sandboxPolicy,
    ...options
  }: AgentServiceOptions) {
    const sessionRepo = this.sessionManagerFactory.create(workspaceId);
    const credential = await this.credentialService.getCredential(TAVILY_CREDENTIAL_ID);
    const tavilyApiKey =
      credential?.type === "api_key" && credential.key?.trim() ? credential.key.trim() : undefined;
    const core = new AgentCore({
      ...options,
      models: this.models,
      sessionRepo,
      builtinSkills: this.builtinSkillService.getCoreOptions(),
      tavilyApiKey,
    });
    const harness = await core.getAgentHarness({
      model,
      metadata,
      agentMode,
      permissionMode,
      requestApproval,
      requestUser,
      sandboxPolicy,
      listAutomations: this.listAutomationsHandler
        ? (input) => this.listAutomationsHandler!(workspaceId, input)
        : undefined,
      createAutomation: this.createAutomationHandler
        ? (input) => this.createAutomationHandler!(workspaceId, input)
        : undefined,
      updateAutomation: this.updateAutomationHandler
        ? (input) => this.updateAutomationHandler!(workspaceId, input)
        : undefined,
      deleteAutomation: this.deleteAutomationHandler
        ? (input) => this.deleteAutomationHandler!(workspaceId, input)
        : undefined,
    });
    return this.interceptStatistics(harness, {
      source: "chat",
      workspaceId,
      sessionId: metadata.id,
    });
  }

  private interceptStatistics(
    harness: AgentHarness,
    options: StatisticsInterceptorOptions,
  ): AgentHarness {
    let runId: number | undefined;
    harness.subscribe((event) => {
      if (event.type === "agent_start") {
        runId = this.recordStatistics(() => this.statisticsService.startRun(options));
        return;
      }
      if (
        event.type === "message_end" &&
        runId !== undefined &&
        event.message.role === "assistant"
      ) {
        this.recordMessageUsage(runId, event);
        return;
      }
      if (event.type === "agent_end") {
        runId = undefined;
      }
    });
    return harness;
  }

  private recordMessageUsage(
    runId: number,
    event: Extract<AgentHarnessEvent, { type: "message_end" }>,
  ): void {
    const message = event.message as AssistantMessage;
    const modelId = message.responseModel ?? message.model;
    const providerName = this.models.getProvider(message.provider)?.name ?? message.provider;
    const modelName = this.models.getModel(message.provider, modelId)?.name ?? modelId;
    this.recordStatistics(() =>
      this.statisticsService.recordUsage({ runId, message, providerName, modelName }),
    );
  }

  private recordStatistics<T>(operation: () => T): T | undefined {
    try {
      return operation();
    } catch (error) {
      console.error("Failed to record agent statistics:", error);
      return undefined;
    }
  }
}
