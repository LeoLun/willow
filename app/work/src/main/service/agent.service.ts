import { createAutomationTools } from "@main/service/automation-tool.service";
import { ConfigService } from "@main/service/config.service";
import {
  ContextCompressionService,
  type ContextCompressionNotification,
} from "@main/service/context-compression.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import { TavilyService } from "@main/service/tavily.service";
import { TodoService } from "@main/service/todo.service";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
import { Agent } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ModelConfig, Session } from "@shared/api";
import { getBuiltinModelConfig } from "@shared/model-config";
import { CoreAgent } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { app } from "electron";

function isAssistantMessage(message: unknown): message is {
  role: "assistant";
  api: string;
  provider: string;
  model: string;
  content: Array<{ type: string; thinkingSignature?: string }>;
} {
  return (
    !!message && typeof message === "object" && (message as { role?: string }).role === "assistant"
  );
}

function normalizeDeepSeekReasoningHistory<T extends { role: string }>(
  history: T[],
  targetModel: ReturnType<typeof toAgentModel>,
): T[] {
  if (targetModel.provider !== "deepseek" || targetModel.api !== "openai-completions") {
    return history;
  }

  return history.map((message) => {
    if (!isAssistantMessage(message)) {
      return message;
    }

    const hasReasoningContent = message.content.some(
      (block) => block.type === "thinking" && block.thinkingSignature === "reasoning_content",
    );

    if (!hasReasoningContent) {
      return message;
    }

    if (message.provider !== targetModel.provider || message.api !== targetModel.api) {
      return message;
    }

    return {
      ...message,
      // DeepSeek 的 reasoning 历史要求按当前请求模型身份原样回传；
      // 否则 pi-ai 会把 thinking 降级成普通文本，导致后续多轮 400。
      model: targetModel.id,
    };
  });
}

function toAgentModel(config: ModelConfig) {
  const builtin = getBuiltinModelConfig(config.modelId);
  return {
    id: config.modelId,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: config.reasoning,
    input: (builtin?.input ?? ["text"]) as ("text" | "image")[],
    cost: builtin?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
    ...(builtin?.compat ? { compat: builtin.compat } : {}),
  };
}

const titleSystemPrompt = `你是会话标题生成器。根据用户给出的「首轮用户输入」生成一条简短中文标题。
要求：10～20 字为宜；只输出标题本身，不要引号、书名号、前缀（如「标题：」）、解释或换行。`;

export interface AgentContextCompressionState {
  displayMessagePrefix: ReturnType<typeof parseStoredSessionMessages>;
  replaceMessageIds: number[];
  notification?: ContextCompressionNotification;
}

export type WillowCoreAgent = CoreAgent & {
  contextCompression?: AgentContextCompressionState;
};

@Injectable()
export class AgentService {
  constructor(
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly configService: ConfigService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly tavilyService: TavilyService,
    private readonly todoService: TodoService,
    private readonly contextCompressionService: ContextCompressionService,
  ) {}

  private resolveApiKey(config?: ModelConfig | null): string | undefined {
    return config?.apiKey || process.env.DEEPSEEK_API_KEY;
  }

  async getTitleAgent() {
    const dbModel = this.configService.getDefaultModel();
    // 如果没有直接默认模型直接报错
    if (!dbModel) {
      throw new Error("No default model found");
    }
    const resolvedModel = { ...toAgentModel(dbModel), reasoning: false };
    const apiKey = this.resolveApiKey(dbModel);

    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => apiKey,
    });
    agent.state.model = resolvedModel as any;
    agent.state.systemPrompt = titleSystemPrompt;

    return agent;
  }

  async getDefaultAgent(
    session: Session,
    modelId?: string,
    webSearchEnabled?: boolean,
    currentInput = "",
  ): Promise<WillowCoreAgent> {
    let dbModel: ModelConfig | undefined;

    if (modelId) {
      dbModel = this.configService.getModelByModelId(modelId) ?? undefined;
    }
    if (!dbModel) {
      dbModel = this.configService.getDefaultModel() ?? undefined;
    }
    if (!dbModel) {
      throw new Error("No model found");
    }

    const resolvedModel = toAgentModel(dbModel);
    const apiKey = this.resolveApiKey(dbModel);

    const workspace = this.workspaceDao.findById(session.workspaceId);
    const cwd = workspace?.path ?? process.cwd();

    const rows = this.sessionMessageDao.findBySessionId(session.id);
    const parsedHistory = parseStoredSessionMessages(rows);
    const preparedContext = await this.contextCompressionService.prepare({
      sessionId: session.id,
      model: dbModel,
      rows,
      history: parsedHistory,
      currentInput,
    });
    const history = normalizeDeepSeekReasoningHistory(preparedContext.messages, resolvedModel);

    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => apiKey,
    });
    agent.state.model = resolvedModel as any;

    const tavilyService = this.tavilyService;
    const todoStore = this.todoService.createStore(session.id);
    const coreAgent = new CoreAgent(agent, {
      cwd,
      userData: app.getPath("userData"),
      websearch: webSearchEnabled ? { getApiKey: () => tavilyService.getApiKey() } : undefined,
      todoStore,
      extraTools: createAutomationTools(),
      compressedContext: preparedContext.compressedContext,
    }) as WillowCoreAgent;

    if (preparedContext.displayMessagePrefix || preparedContext.replaceMessageIds) {
      coreAgent.contextCompression = {
        displayMessagePrefix: preparedContext.displayMessagePrefix ?? [],
        replaceMessageIds: preparedContext.replaceMessageIds ?? [],
        notification: preparedContext.notification,
      };
    }

    if (history.length > 0) {
      agent.state.messages = history;
    }

    return coreAgent;
  }
}
