import { SessionContextSummaryDao } from "@main/service/dao/session-context-summary.dao.service";
import { lastAssistantTextOnly } from "@main/utils/agent-message-text";
import {
  planContextMessageWindow,
  type ContextMessageEntry,
} from "@main/utils/context-message-window";
import {
  buildCompressedContext,
  buildContextSummaryPrompt,
  contextSummarySystemPrompt,
  extractIndexSection,
} from "@main/utils/context-summary-prompt";
import {
  estimateAgentMessagesTokens,
  estimateTextTokens,
} from "@main/utils/context-token-estimator";
import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { Agent } from "@mariozechner/pi-agent-core";
import { streamSimple } from "@mariozechner/pi-ai";
import type { ModelConfig } from "@shared/api";
import { Injectable } from "@willow/poetry";

const SUMMARY_TIMEOUT_MS = 10_000;
const ESTIMATED_SYSTEM_TOKENS = 4096;

interface SessionMessageRow {
  id: number;
  content: string;
}

export interface ContextCompressionNotification {
  sessionId: number;
  status: "compressed" | "degraded";
  message?: string;
  estimatedTokens?: number;
}

export interface PreparedContextCompression {
  messages: AgentMessage[];
  compressedContext?: string;
  displayMessagePrefix?: AgentMessage[];
  replaceMessageIds?: number[];
  notification?: ContextCompressionNotification;
}

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

function resolveApiKey(config: ModelConfig): string | undefined {
  return config.apiKey || process.env.DEEPSEEK_API_KEY;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("context summary timed out")), timeoutMs);
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
export class ContextCompressionService {
  constructor(private readonly summaryDao: SessionContextSummaryDao) {}

  async prepare(params: {
    sessionId: number;
    model: ModelConfig;
    rows: SessionMessageRow[];
    history: AgentMessage[];
    currentInput: string;
  }): Promise<PreparedContextCompression> {
    const existing = this.summaryDao.findBySessionAndModel(params.sessionId, params.model.modelId);
    const existingContext = existing
      ? buildCompressedContext(existing.summary, existing.indexText)
      : undefined;
    const entries = params.history.map((message, index): ContextMessageEntry => {
      return { id: params.rows[index]?.id, message };
    });
    const plan = planContextMessageWindow({
      entries,
      contextWindow: params.model.contextWindow,
      maxTokens: params.model.maxTokens,
      currentInput: params.currentInput,
      systemTokens: ESTIMATED_SYSTEM_TOKENS,
      summaryText: existingContext,
      compressedUntilMessageId: existing?.compressedUntilMessageId ?? null,
    });

    if (!plan.shouldCompress) {
      return { messages: params.history };
    }

    let summary = existing?.summary ?? "";
    let indexText = existing?.indexText ?? "";
    let compressedContext = existingContext;
    let compressionFailed = false;

    if (plan.messagesToCompress.length > 0) {
      try {
        summary = await this.generateSummary({
          model: params.model,
          previousSummary: summary,
          messages: plan.messagesToCompress.map((entry) => entry.message),
        });
        indexText = extractIndexSection(summary);
        compressedContext = buildCompressedContext(summary, indexText);
        const compressedIds = plan.messagesToCompress
          .map((entry) => entry.id)
          .filter((id): id is number => typeof id === "number");
        const compressedUntilMessageId = compressedIds.length > 0 ? Math.max(...compressedIds) : 0;
        this.summaryDao.upsertForSessionAndModel({
          sessionId: params.sessionId,
          modelId: params.model.modelId,
          summary,
          indexText,
          compressedUntilMessageId,
          sourceMessageCount: plan.messagesToCompress.length,
          estimatedTokens: estimateTextTokens(compressedContext),
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (error) {
        compressionFailed = true;
        console.error(
          "context compression failed",
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
        "较早历史因上下文不足且本次自动压缩失败，可能无法完整提供。请优先依据最近完整消息继续工作；如需要早期细节，应询问用户或查阅可用文件。";
      return {
        messages: plan.recentMessages.map((entry) => entry.message),
        compressedContext,
        displayMessagePrefix: plan.preservedMessages.map((entry) => entry.message),
        replaceMessageIds: plan.recentMessages
          .map((entry) => entry.id)
          .filter((id): id is number => typeof id === "number"),
        notification: {
          sessionId: params.sessionId,
          status: "degraded",
          message: "较早历史可能不完整，AI 已优先保留最近上下文",
          estimatedTokens: plan.plannedInputTokens,
        },
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
      notification: {
        sessionId: params.sessionId,
        status: "compressed",
        message: "上下文已自动压缩，较早消息已摘要供 AI 参考",
        estimatedTokens: actualInputTokens,
      },
    };
  }

  private async generateSummary(params: {
    model: ModelConfig;
    previousSummary?: string;
    messages: AgentMessage[];
  }): Promise<string> {
    const agent = new Agent({
      streamFn: streamSimple,
      getApiKey: () => resolveApiKey(params.model),
    });
    agent.setModel(toAgentModel(params.model));
    agent.setSystemPrompt(contextSummarySystemPrompt);
    await withTimeout(
      agent.prompt(
        buildContextSummaryPrompt({
          previousSummary: params.previousSummary,
          messages: params.messages,
        }),
      ),
      SUMMARY_TIMEOUT_MS,
    );

    const summary = lastAssistantTextOnly(agent.state.messages).trim();
    if (!summary) {
      throw new Error("context summary is empty");
    }
    return summary;
  }
}
