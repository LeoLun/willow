import { createAutomationTools } from "@main/service/automation-tool.service";
import { ConfigService } from "@main/service/config.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import { TavilyService } from "@main/service/tavily.service";
import { TodoService } from "@main/service/todo.service";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
import { Agent } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ModelConfig, Session } from "@shared/api";
import { CoreAgent } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { app } from "electron";

const FALLBACK_MODELS: Record<string, ReturnType<typeof toAgentModel>> = {
  "deepseek-chat": {
    id: "deepseek-chat",
    name: "DeepSeek Chat",
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    reasoning: false,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 64000,
    maxTokens: 8192,
  },
  "deepseek-reasoner": {
    id: "deepseek-reasoner",
    name: "DeepSeek Reasoner",
    api: "openai-completions",
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com",
    reasoning: true,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 64000,
    maxTokens: 8192,
  },
};

function toAgentModel(config: ModelConfig) {
  return {
    id: config.modelId,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: ["text"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
  };
}

const titleSystemPrompt = `你是会话标题生成器。根据用户给出的「首轮用户提问」和「助手回复」摘要，生成一条简短中文标题。
要求：10～20 字为宜；只输出标题本身，不要引号、书名号、前缀（如「标题：」）、解释或换行。`;

@Injectable()
export class AgentService {
  constructor(
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly configService: ConfigService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly tavilyService: TavilyService,
    private readonly todoService: TodoService,
  ) {}

  private resolveApiKey(config?: ModelConfig | null): string | undefined {
    return config?.apiKey || process.env.DEEPSEEK_API_KEY;
  }

  async getTitleAgent() {
    const dbModel = this.configService.getModelByModelId("deepseek-chat");
    const resolvedModel = dbModel ? toAgentModel(dbModel) : FALLBACK_MODELS["deepseek-chat"];
    const apiKey = this.resolveApiKey(dbModel);

    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => apiKey,
    });
    agent.setModel(resolvedModel);
    agent.setSystemPrompt(titleSystemPrompt);

    return agent;
  }

  async getDefaultAgent(session: Session, modelId?: string, webSearchEnabled?: boolean) {
    let dbModel: ModelConfig | undefined;

    if (modelId) {
      dbModel = this.configService.getModelByModelId(modelId) ?? undefined;
    }
    if (!dbModel) {
      dbModel = this.configService.getDefaultModel() ?? undefined;
    }

    const resolvedModel = dbModel ? toAgentModel(dbModel) : FALLBACK_MODELS["deepseek-reasoner"];
    const apiKey = this.resolveApiKey(dbModel);

    const workspace = this.workspaceDao.findById(session.workspaceId);
    const cwd = workspace?.path ?? process.cwd();

    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => apiKey,
    });
    agent.setModel(resolvedModel);

    const tavilyService = this.tavilyService;
    const todoStore = this.todoService.createStore(session.id);
    const coreAgent = new CoreAgent(agent, {
      cwd,
      userData: app.getPath("userData"),
      websearch: webSearchEnabled ? { getApiKey: () => tavilyService.getApiKey() } : undefined,
      todoStore,
      extraTools: createAutomationTools(),
    });

    const rows = this.sessionMessageDao.findBySessionId(session.id);
    const history = parseStoredSessionMessages(rows);
    if (history.length > 0) {
      agent.replaceMessages(history);
    }

    return coreAgent;
  }
}
