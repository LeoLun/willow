import type { MutableModels } from "@earendil-works/pi-ai";
import { builtinModels } from "@earendil-works/pi-ai/providers/all";
import { AgentCore, type AgentCoreOptions } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { CredentialService } from "./credential.service";
import { SessionManagerFactory } from "./session-manager.factory";

type AgentServiceOptions = Omit<AgentCoreOptions, "models" | "sessionRepo"> & {
  workspaceId: number;
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

  getSimpleAgent() {}

  // 获取完整的AgentHarness，用于执行复杂任务，会记录上下文到数据库
  getAgentHarness({ workspaceId, ...options }: AgentServiceOptions) {
    const sessionRepo = this.sessionManagerFactory.create(workspaceId);
    return new AgentCore({ ...options, models: this.models, sessionRepo });
  }
}
