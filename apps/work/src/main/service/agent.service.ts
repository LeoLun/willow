import {
  AgentHarness,
  InMemorySessionRepo,
  type SessionMetadata,
} from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import type { Model, MutableModels } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { AgentCore, type AgentCoreOptions } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { CredentialService } from "./credential.service";
import { SessionManagerFactory } from "./session-manager.factory";

type AgentServiceOptions = Omit<AgentCoreOptions, "models" | "sessionRepo"> & {
  workspaceId: number;
  model: Model<any>;
  metadata: SessionMetadata;
};

type SimpleAgentOptions = {
  cwd: string;
  model: Model<any>;
  systemPrompt: string;
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
    return new AgentHarness({
      models: this.models,
      env: new NodeExecutionEnv({ cwd: options.cwd }),
      session,
      model: options.model,
      systemPrompt: options.systemPrompt,
      tools: [],
      thinkingLevel: "off",
    });
  }

  // 获取完整的AgentHarness，用于执行复杂任务，会记录上下文到数据库
  async getAgentHarness({ workspaceId, model, metadata, ...options }: AgentServiceOptions) {
    const sessionRepo = this.sessionManagerFactory.create(workspaceId);
    const core = new AgentCore({ ...options, models: this.models, sessionRepo });
    return core.getAgentHarness({ model, metadata });
  }
}
