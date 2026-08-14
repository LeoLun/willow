import { AgentHarness, type ExecutionEnv, type SessionRepo } from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import type { Model, MutableModels } from "@earendil-works/pi-ai";
import { AGENT_DIR } from "./constant";
import { getPlanModePrompt } from "./prompt/plan-mode.js";
import { createWillowTools } from "./tools/index.js";
import { restoreTodoList } from "./tools/todo-list.js";
import type { AgentCoreOptions, AgentHarnessOptions } from "./types";
import { resolvePlanDirectory } from "./utils/agent-paths.js";
import { DefaultResourceLoader } from "./utils/resource-loader";

// AgentCore 每个工作空间一个
export class AgentCore {
  private models: MutableModels;
  private env: ExecutionEnv;
  private cwd: string; // 工作目录
  private agentDir: string; // 全局目录
  private sessionManager: SessionRepo;
  private loader: DefaultResourceLoader;
  private builtinSkills?: AgentCoreOptions["builtinSkills"];
  private tavilyApiKey?: string;

  constructor(options: AgentCoreOptions) {
    this.cwd = options.cwd;
    this.agentDir = options.agentDir || AGENT_DIR;
    this.env = new NodeExecutionEnv({ cwd: this.cwd });
    this.models = options.models;
    this.sessionManager = options.sessionRepo;
    this.builtinSkills = options.builtinSkills;
    this.tavilyApiKey = options.tavilyApiKey;

    this.loader = new DefaultResourceLoader({
      cwd: this.cwd,
      agentDir: this.agentDir,
      builtinSkills: this.builtinSkills,
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

  async getSkills() {
    return await this.loader.reloadSkills();
  }

  async getAgentHarness(options: AgentHarnessOptions) {
    const permissionMode = options.permissionMode ?? "request-approval";
    if (permissionMode !== "full-access" && process.platform !== "darwin") {
      throw new Error("Sandboxed permission modes are currently supported only on macOS");
    }
    const session = options.metadata
      ? await this.sessionManager.open(options.metadata)
      : await this.sessionManager.create({});

    const agentMode = options.agentMode ?? "default";
    const roleAdditional =
      agentMode === "plan" ? getPlanModePrompt(resolvePlanDirectory(this.agentDir)) : "";
    const { systemPrompt } = await this.loader.reload(roleAdditional);
    const initialTodoList = restoreTodoList(await session.getBranch());

    const shouldExtendSandboxPolicy = this.builtinSkills !== undefined || agentMode === "plan";
    const sandboxPolicy = shouldExtendSandboxPolicy
      ? {
          ...options.sandboxPolicy,
          allowRead: [
            ...(options.sandboxPolicy?.allowRead ?? []),
            ...(this.builtinSkills ? [this.builtinSkills.directory] : []),
            ...(agentMode === "plan" ? [resolvePlanDirectory(this.agentDir)] : []),
          ],
          allowWrite:
            agentMode === "plan"
              ? options.sandboxPolicy?.allowWrite
              : [
                  ...(options.sandboxPolicy?.allowWrite ?? []),
                  ...(this.builtinSkills ? [this.builtinSkills.directory] : []),
                ],
        }
      : options.sandboxPolicy;
    const harness = new AgentHarness({
      models: this.models,
      env: this.env,
      session: session,
      model: options.model,
      thinkingLevel: "high",
      tools: createWillowTools({
        cwd: this.cwd,
        agentDir: this.agentDir,
        agentMode,
        permissionMode,
        requestApproval: options.requestApproval,
        requestUser: options.requestUser,
        sandboxPolicy,
        tavilyApiKey: this.tavilyApiKey,
        initialTodoList,
        listAutomations: options.listAutomations,
        createAutomation: options.createAutomation,
        updateAutomation: options.updateAutomation,
        deleteAutomation: options.deleteAutomation,
      }),
      systemPrompt: systemPrompt,
      steeringMode: "all",
      followUpMode: "all",
    });

    return harness;
  }
}
