import type { ModelConfig, ProviderInfo } from "@shared/api";
import type { Message, MessageUsage } from "@/components/message-list";

export interface SessionUsageSummary {
  turns: number;
  steps: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens: number;
  cacheRatio: number;
  contextTokens: number;
  contextWindow: number;
  contextRatio: number;
  modelName?: string;
}

export function formatTokenCount(tokens: number): string {
  const value = Math.max(0, Math.round(tokens));
  if (value >= 1_000_000) {
    const formatted = (value / 1_000_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}M`;
  }
  if (value >= 1_000) {
    const formatted = (value / 1_000).toFixed(1).replace(/\.0$/, "");
    return `${formatted}K`;
  }
  return String(value);
}

export function formatPercent(ratio: number): string {
  const percent = Math.min(100, Math.max(0, Math.round(ratio * 100)));
  return `${percent}%`;
}

function contextTokens(usage: MessageUsage): number {
  return usage.totalTokens || usage.input + usage.output + usage.cacheRead + usage.cacheWrite;
}

function findModel(
  providers: readonly ProviderInfo[],
  providerId: string | undefined,
  modelIds: Array<string | undefined>,
) {
  if (!providerId) return undefined;
  const models = providers.find((provider) => provider.id === providerId)?.models ?? [];
  for (const modelId of modelIds) {
    const model = models.find((candidate) => candidate.id === modelId);
    if (model) return model;
  }
  return undefined;
}

export function calculateSessionUsage(
  messages: readonly Message[],
  providers: readonly ProviderInfo[],
  selectedModel?: ModelConfig,
): SessionUsageSummary {
  let turns = 0;
  let steps = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let totalTokens = 0;
  let cacheReadTokens = 0;
  let latest: (Message & { usage: MessageUsage }) | undefined;

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    if (message.role === "user") {
      turns += 1;
    } else if (message.role === "assistant") {
      steps += 1;
      if (message.usage) {
        inputTokens += message.usage.input;
        outputTokens += message.usage.output;
        cacheReadTokens += message.usage.cacheRead;
        const tokens = contextTokens(message.usage);
        totalTokens += tokens;
        if (message.stopReason !== "error" && message.stopReason !== "aborted" && tokens > 0) {
          latest = message as Message & { usage: MessageUsage };
        }
      }
    }
  }

  const model = latest
    ? findModel(providers, latest.provider, [latest.responseModel, latest.model])
    : findModel(providers, selectedModel?.providerId, [selectedModel?.modelId]);
  const currentContextTokens = latest ? contextTokens(latest.usage) : 0;
  const contextWindow = Math.max(0, model?.contextWindow ?? 0);

  return {
    turns,
    steps,
    inputTokens,
    outputTokens,
    totalTokens,
    cacheReadTokens,
    cacheRatio: totalTokens > 0 ? cacheReadTokens / totalTokens : 0,
    contextTokens: currentContextTokens,
    contextWindow,
    contextRatio: contextWindow > 0 ? currentContextTokens / contextWindow : 0,
    modelName: model?.name,
  };
}
