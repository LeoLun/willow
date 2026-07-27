import {
  AgentHarness,
  InMemorySessionRepo,
  type AgentHarnessEvent,
  type SessionMetadata,
} from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import type { AssistantMessage, Model, MutableModels } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { AgentCore, type AgentCoreOptions, type ToolApprovalHandler } from "@willow/core";
import { Injectable } from "@willow/poetry";
import type { StatisticsRunSource } from "../db/schema";
import { CredentialService } from "./credential.service";
import { SessionManagerFactory } from "./session-manager.factory";
import { StatisticsService } from "./statistics.service";

type AgentServiceOptions = Omit<AgentCoreOptions, "models" | "sessionRepo"> & {
  workspaceId: number;
  model: Model<any>;
  metadata: SessionMetadata;
  permissionMode: import("@willow/core").PermissionMode;
  requestApproval: ToolApprovalHandler;
};

type SimpleAgentOptions = {
  cwd: string;
  model: Model<any>;
  systemPrompt: string;
  workspaceId: number;
  sessionId: string;
  source: Extract<StatisticsRunSource, "approval" | "title">;
};

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

  constructor(
    private readonly credentialService: CredentialService,
    private readonly sessionManagerFactory: SessionManagerFactory,
    private readonly statisticsService: StatisticsService,
  ) {
    const credentialStore = this.credentialService.getCredentialStore();
    this.models = builtinModels({ credentials: credentialStore });
  }

  getModels() {
    return this.models;
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
    permissionMode,
    requestApproval,
    ...options
  }: AgentServiceOptions) {
    const sessionRepo = this.sessionManagerFactory.create(workspaceId);
    const core = new AgentCore({ ...options, models: this.models, sessionRepo });
    const harness = await core.getAgentHarness({
      model,
      metadata,
      permissionMode,
      requestApproval,
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
