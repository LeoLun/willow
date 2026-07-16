import type { CredentialStore } from "@earendil-works/pi-ai";
import { AgentCore } from "@willow/core";
import type { AgentCoreOptions } from "@willow/core";
import { Injectable } from "@willow/poetry";

/**
 * 用于创建 Agent 对象的服务
 */
@Injectable()
export class AgentService {
  private credentialStore: CredentialStore;

  constructor() {
    // 创建密钥存储对象
    this.credentialStore = {} as any;
  }

  getSimpleAgent() {}

  // 获取完整的AgentHarness，用于执行复杂任务，会记录上下文到数据库
  getAgentHarness(options: AgentCoreOptions) {
    return new AgentCore(options);
  }
}
