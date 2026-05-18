import type {
  ContextCompressionNotification,
  PreparedContextCompression,
} from "@main/service/context-compression.service";
import { ConversationContextStateDao } from "@main/service/dao/conversation-context-state.dao.service";
import { lastAssistantTextOnly } from "@main/utils/agent-message-text";
import {
  planContextMessageWindow,
  type ContextMessageEntry,
} from "@main/utils/context-message-window";
import {
  estimateAgentMessagesTokens,
  estimateTextTokens,
} from "@main/utils/context-token-estimator";
import {
  buildConversationCompressedContext,
  buildConversationContextPrompt,
  conversationContextSystemPrompt,
  extractConversationSection,
} from "@main/utils/conversation-context-prompt";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ModelConfig } from "@shared/api";
import { getBuiltinModelConfig } from "@shared/model-config";
import { Injectable } from "@willow/poetry";

const SUMMARY_TIMEOUT_MS = 10_000;
const ESTIMATED_SYSTEM_TOKENS = 4096;

interface SessionMessageRow {
  id: number;
  content: string;
}

function toAgentModel(config: ModelConfig) {
  const builtin = getBuiltinModelConfig(config.modelId);
  return {
    id: config.modelId,
    name: config.name,
    api: config.api,
    provider: config.provider,
    baseUrl: config.baseUrl,
    reasoning: false,
    input: (builtin?.input ?? ["text"]) as ("text" | "image")[],
    cost: builtin?.cost ?? { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: config.contextWindow,
    maxTokens: config.maxTokens,
    ...(builtin?.compat ? { compat: builtin.compat } : {}),
  };
}

function resolveApiKey(config: ModelConfig): string | undefined {
  return config.apiKey || process.env.DEEPSEEK_API_KEY;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("conversation context summary timed out")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

@Injectable()
export class ConversationContextCompressionService {
  constructor(private readonly stateDao: ConversationContextStateDao) {}

  async prepare(params: {
    sessionId: number;
    model: ModelConfig;
    rows: SessionMessageRow[];
    history: AgentMessage[];
    currentInput: string;
  }): Promise<PreparedContextCompression> {
    const existing = this.stateDao.findBySessionAndModel(params.sessionId, params.model.modelId);
    const existingContext = existing
      ? buildConversationCompressedContext({
          summary: existing.summary,
          stableFacts: existing.stableFacts,
          openLoops: existing.openLoops,
        })
      : undefined;

    const entries = params.history.map(
      (message, index): ContextMessageEntry => ({
        id: params.rows[index]?.id,
        message,
      }),
    );

    const plan = planContextMessageWindow({
      entries,
      contextWindow: params.model.contextWindow,
      maxTokens: params.model.maxTokens,
      currentInput: params.currentInput,
      systemTokens: ESTIMATED_SYSTEM_TOKENS,
      summaryText: existingContext,
      compressedUntilMessageId: existing?.compressedUntilMessageId ?? null,
      preferredRecentRounds: 4,
      minimumRecentRounds: 2,
    });

    if (!plan.shouldCompress) {
      return { messages: params.history };
    }

    let summary = existing?.summary ?? "";
    let stableFacts = existing?.stableFacts ?? "";
    let openLoops = existing?.openLoops ?? "";
    let compressedContext = existingContext;
    let compressionFailed = false;

    if (plan.messagesToCompress.length > 0) {
      try {
        summary = await this.generateSummary({
          model: params.model,
          previousContext: compressedContext,
          messages: plan.messagesToCompress.map((entry) => entry.message),
        });
        stableFacts = extractConversationSection(summary, "长期事实层");
        openLoops = extractConversationSection(summary, "未闭环事项层");
        compressedContext = buildConversationCompressedContext({
          summary,
          stableFacts,
          openLoops,
        });
        const compressedIds = plan.messagesToCompress
          .map((entry) => entry.id)
          .filter((id): id is number => typeof id === "number");
        const compressedUntilMessageId = compressedIds.length > 0 ? Math.max(...compressedIds) : 0;

        this.stateDao.upsertForSessionAndModel({
          sessionId: params.sessionId,
          modelId: params.model.modelId,
          summary,
          stableFacts,
          openLoops,
          checkpointIndex: (existing?.checkpointIndex ?? 0) + 1,
          compressedUntilMessageId,
          sourceMessageCount: plan.messagesToCompress.length,
          estimatedTokens: estimateTextTokens(compressedContext),
          createdAt: existing?.createdAt ?? new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        compressionFailed = true;
        console.error(
          "conversation context compression failed",
          params.sessionId,
          error instanceof Error ? error.message : error,
        );
      }
    }

    if (!compressedContext || compressionFailed) {
      if (plan.budget.totalInputTokens <= plan.budget.usableContext) {
        return { messages: params.history };
      }

      compressedContext =
        "较早的对话长期上下文本次压缩失败。请优先依据最近消息继续对话，并在必要时主动向用户确认较早约束或未完成事项。";
      return {
        messages: plan.recentMessages.map((entry) => entry.message),
        compressedContext,
        displayMessagePrefix: plan.preservedMessages.map((entry) => entry.message),
        replaceMessageIds: plan.recentMessages
          .map((entry) => entry.id)
          .filter((id): id is number => typeof id === "number"),
        notification: this.buildNotification(params.sessionId, "degraded", plan.plannedInputTokens),
      };
    }

    let recentMessages = plan.recentMessages;
    let preservedMessages = plan.preservedMessages;
    let actualInputTokens =
      estimateTextTokens(compressedContext) +
      estimateAgentMessagesTokens(recentMessages.map((entry) => entry.message)) +
      estimateTextTokens(params.currentInput);

    if (actualInputTokens > plan.budget.triggerThreshold && recentMessages.length > 1) {
      preservedMessages = [...preservedMessages, ...recentMessages.slice(0, -1)];
      recentMessages = [recentMessages[recentMessages.length - 1]];
      actualInputTokens =
        estimateTextTokens(compressedContext) +
        estimateAgentMessagesTokens(recentMessages.map((entry) => entry.message)) +
        estimateTextTokens(params.currentInput);
    }

    return {
      messages: recentMessages.map((entry) => entry.message),
      compressedContext,
      displayMessagePrefix: preservedMessages.map((entry) => entry.message),
      replaceMessageIds: recentMessages
        .map((entry) => entry.id)
        .filter((id): id is number => typeof id === "number"),
      notification: this.buildNotification(params.sessionId, "compressed", actualInputTokens),
    };
  }

  private buildNotification(
    sessionId: number,
    status: ContextCompressionNotification["status"],
    estimatedTokens: number,
  ): ContextCompressionNotification {
    return {
      sessionId,
      status,
      message:
        status === "degraded"
          ? "对话长期上下文本次压缩失败，AI 已优先保留最近消息"
          : "对话长期上下文已自动整理，较早内容已分层压缩",
      estimatedTokens,
    };
  }

  private async generateSummary(params: {
    model: ModelConfig;
    previousContext?: string;
    messages: AgentMessage[];
  }): Promise<string> {
    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => resolveApiKey(params.model),
    });
    agent.state.model = toAgentModel(params.model) as any;
    agent.state.systemPrompt = conversationContextSystemPrompt;
    await withTimeout(
      agent.prompt(
        buildConversationContextPrompt({
          previousContext: params.previousContext,
          messages: params.messages,
        }),
      ),
      SUMMARY_TIMEOUT_MS,
    );

    const summary = lastAssistantTextOnly(agent.state.messages).trim();
    if (!summary) {
      throw new Error("conversation context summary is empty");
    }
    return summary;
  }
}
