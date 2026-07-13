import { homedir } from "node:os";
import { join } from "node:path";
import { createModels, type Model } from "@earendil-works/pi-ai";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { AgentHarness, ExecutionEnv } from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import { AGENT_DIR } from "./constant";
import { SessionManager } from "./session-manager";
import type { AgentCoreOptions, AgentHarnessOptions } from "./types";
import { DefaultResourceLoader } from "./utils/resource-loader";

// AgentCore 每个工作空间一个
export class AgentCore {
  private models: ReturnType<typeof createModels>;
  private env: ExecutionEnv;
  private cwd: string; // 工作目录
  private agentDir: string; // 全局目录
  private sessionManager: SessionManager;
  private loader: DefaultResourceLoader;

  constructor(options: AgentCoreOptions) {
    this.cwd = options.cwd;
    this.agentDir = options.agentDir || AGENT_DIR;
    this.env = new NodeExecutionEnv({ cwd: this.cwd });
    this.models = createModels({ credentials: options.credentials });
    this.models.setProvider(deepseekProvider());

    // 初始化 SessionManager
    const sessionsRoot = join(homedir(), this.agentDir, "agent", "sessions");
    this.sessionManager = new SessionManager({
      env: this.env,
      sessionsRoot,
    });

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
      : await this.sessionManager.create({ cwd: this.cwd });

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
