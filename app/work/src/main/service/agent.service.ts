import { join } from "node:path";
import { createAutomationTools } from "@main/service/automation-tool.service";
import { ConfigService } from "@main/service/config.service";
import {
  ContextCompressionService,
  type ContextCompressionNotification,
} from "@main/service/context-compression.service";
import { ConversationContextCompressionService } from "@main/service/conversation-context-compression.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import { McpServerService } from "@main/service/mcp-server.service";
import { TavilyService } from "@main/service/tavily.service";
import { TodoService } from "@main/service/todo.service";
import { lastAssistantTextOnly } from "@main/utils/agent-message-text";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
import { Agent } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ModelConfig, Session } from "@shared/api";
import { getBuiltinModelConfig } from "@shared/model-config";
import { CoreAgent } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { app } from "electron";
import { createWorkspaceDelegateTool } from "./tools/workspace-delegate.tool";

export type WorkspaceDelegateHandler = (params: {
  workspaceId: number;
  task: string;
  sessionId?: number;
  toolCallId: string;
  parentSessionId: number;
}) => Promise<{
  content: Array<{ type: "text"; text: string }>;
  details: {
    childSessionId: number;
    workspaceId: number;
    workspaceName: string;
    agentName: string;
    status: "completed" | "stopped" | "failed";
    summary: string;
  };
}>;

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

const oneShotTextGenerationSystemPrompt = `你是一个严格遵循输出约束的中文写作者。
要求：
1. 优先遵守用户消息里的格式、字段、结构和长度要求。
2. 只输出最终结果，不补充解释、前言、后记或代码块围栏。
3. 如果用户要求输出 Markdown 文件内容，就直接输出 Markdown 正文。`;

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
  private workspaceDelegateHandler?: WorkspaceDelegateHandler;

  registerWorkspaceDelegateHandler(handler: WorkspaceDelegateHandler) {
    this.workspaceDelegateHandler = handler;
  }

  constructor(
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly configService: ConfigService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly tavilyService: TavilyService,
    private readonly todoService: TodoService,
    private readonly contextCompressionService: ContextCompressionService,
    private readonly conversationContextCompressionService: ConversationContextCompressionService,
    private readonly mcpServerService: McpServerService,
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

  async generateSingleTurnText(
    userPrompt: string,
    systemPrompt = oneShotTextGenerationSystemPrompt,
  ) {
    const dbModel = this.configService.getDefaultModel();
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
    agent.state.systemPrompt = systemPrompt;
    await agent.prompt(userPrompt);

    const result = lastAssistantTextOnly(agent.state.messages).trim();
    if (!result) {
      throw new Error("LLM did not return any text");
    }

    return result;
  }

  async getDefaultAgent(
    session: Session,
    modelId?: string,
    webSearchEnabled?: boolean,
    currentInput = "",
    targetWorkspaceId?: number,
    workspaceAgentsContext?: string,
  ): Promise<WillowCoreAgent> {
    let dbModel: ModelConfig | undefined;
    let targetThinkingLevel: string | undefined;

    let resolvedModelId = modelId;
    if (resolvedModelId && resolvedModelId.includes(":")) {
      const parts = resolvedModelId.split(":");
      resolvedModelId = parts[0];
      targetThinkingLevel = parts[1];
    }

    if (resolvedModelId) {
      dbModel = this.configService.getModelByModelId(resolvedModelId) ?? undefined;
    }
    if (!dbModel) {
      dbModel = this.configService.getDefaultModel() ?? undefined;
    }
    if (!dbModel) {
      throw new Error("No model found");
    }

    const resolvedModel = toAgentModel(dbModel);
    const apiKey = this.resolveApiKey(dbModel);

    const workspace = this.workspaceDao.findById(targetWorkspaceId ?? session.workspaceId);
    const cwd = workspace?.path ?? process.cwd();

    const rows = this.sessionMessageDao.findBySessionId(session.id);
    const parsedHistory = parseStoredSessionMessages(rows);
    const preparedContext =
      workspace?.kind === "conversation"
        ? await this.conversationContextCompressionService.prepare({
            sessionId: session.id,
            model: dbModel,
            rows,
            history: parsedHistory,
            currentInput,
          })
        : await this.contextCompressionService.prepare({
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
    if (targetThinkingLevel) {
      agent.state.thinkingLevel = targetThinkingLevel as any;
    } else if (resolvedModel.reasoning) {
      agent.state.thinkingLevel = "high";
    }

    const tavilyService = this.tavilyService;
    const todoStore = this.todoService.createStore(session.id);

    const automationDefaultWorkspaceId = workspace?.kind === "project" ? workspace.id : undefined;
    const extraTools = [...createAutomationTools(automationDefaultWorkspaceId)];
    if (this.workspaceDelegateHandler) {
      extraTools.push(createWorkspaceDelegateTool(session.id, this.workspaceDelegateHandler));
    }

    // Load active MCP tools
    const mcpServerService = this.mcpServerService;
    try {
      const mcpTools = await mcpServerService.getActiveTools(
        targetWorkspaceId ?? session.workspaceId,
      );
      for (const mt of mcpTools) {
        extraTools.push({
          name: mt.name,
          description: mt.description,
          parameters: mt.inputSchema,
          meta: {
            label: mt.description || mt.name,
            permission: () => ({ mode: "allow" }),
          },
          async execute(toolCallId: string, params: any, _signal: any, _onUpdate: any) {
            const result = await mcpServerService.callActiveTool(
              mt.clientKey,
              mt.originalName,
              params,
            );
            return {
              content: result.content || [],
              isError: result.isError ?? false,
            };
          },
        } as any);
      }
    } catch (e) {
      console.error("Failed to load active MCP tools:", e);
    }

    const builtinDir = app.isPackaged
      ? join(process.resourcesPath, "builtin-skills")
      : join(app.getAppPath(), "builtin-skills");

    const coreAgent = new CoreAgent(agent, {
      cwd,
      userData: app.getPath("userData"),
      builtinDir,
      websearch: webSearchEnabled ? { getApiKey: () => tavilyService.getApiKey() } : undefined,
      todoStore,
      extraTools,
      compressedContext: preparedContext.compressedContext,
      workspaceAgentsContext,
    }) as WillowCoreAgent;

    if (targetWorkspaceId) {
      coreAgent.agent.state.systemPrompt += `\n\n用户明确指定了目标工作空间 Agent（ID: ${targetWorkspaceId}）。你必须调用 \`workspace_delegate\` 工具，将用户的提问指派给该工作空间 Agent。禁止直接回答或使用其他工具。`;
    }

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
