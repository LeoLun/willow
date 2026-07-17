import { AgentHarness, type ExecutionEnv, type SessionRepo } from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import type { Model, MutableModels } from "@earendil-works/pi-ai";
import { AGENT_DIR } from "./constant";
import type { AgentCoreOptions, AgentHarnessOptions } from "./types";
import { DefaultResourceLoader } from "./utils/resource-loader";

// AgentCore 每个工作空间一个
export class AgentCore {
  private models: MutableModels;
  private env: ExecutionEnv;
  private cwd: string; // 工作目录
  private agentDir: string; // 全局目录
  private sessionManager: SessionRepo;
  private loader: DefaultResourceLoader;

  constructor(options: AgentCoreOptions) {
    this.cwd = options.cwd;
    this.agentDir = options.agentDir || AGENT_DIR;
    this.env = new NodeExecutionEnv({ cwd: this.cwd });
    this.models = options.models;
    this.sessionManager = options.sessionRepo;

    this.loader = new DefaultResourceLoader({
      cwd: this.cwd,
      agentDir: this.agentDir,
      env: this.env,
    });
  }

  getModel(providerId: string, modelId: string): Model<any> {
    const model = this.models.getModel(providerId, modelId);
    if (!model) {
      throw new Error(`不支持的模型: ${providerId}/${modelId}`);
    }
    return model;
  }

  async getAgentHarness(options: AgentHarnessOptions) {
    const session = options.metadata
      ? await this.sessionManager.open(options.metadata)
      : await this.sessionManager.create({});

    const { systemPrompt } = await this.loader.reload();

    const harness = new AgentHarness({
      models: this.models,
      env: this.env,
      session: session,
      model: options.model,
      thinkingLevel: "high",
      systemPrompt: systemPrompt,
      steeringMode: "all",
      followUpMode: "all",
    });

    return harness;
  }
}
