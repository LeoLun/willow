import type { ModelConfig, ProviderInfo } from "@shared/api";
import type { Message, MessageUsage } from "@/components/message-list";

export interface SessionUsageSummary {
  totalTokens: number;
  cacheReadTokens: number;
  cacheRatio: number;
  contextTokens: number;
  contextWindow: number;
  contextRatio: number;
  modelName?: string;
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
  const assistantMessages = messages.filter(
    (message): message is Message & { usage: MessageUsage } =>
      message.role === "assistant" && message.usage !== undefined,
  );
  const totalTokens = assistantMessages.reduce(
    (sum, message) => sum + contextTokens(message.usage),
    0,
  );
  const cacheReadTokens = assistantMessages.reduce(
    (sum, message) => sum + message.usage.cacheRead,
    0,
  );
  const latest = assistantMessages.findLast(
    (message) =>
      message.stopReason !== "error" &&
      message.stopReason !== "aborted" &&
      contextTokens(message.usage) > 0,
  );
  const model = latest
    ? findModel(providers, latest.provider, [latest.responseModel, latest.model])
    : findModel(providers, selectedModel?.providerId, [selectedModel?.modelId]);
  const currentContextTokens = latest ? contextTokens(latest.usage) : 0;
  const contextWindow = Math.max(0, model?.contextWindow ?? 0);

  return {
    totalTokens,
    cacheReadTokens,
    cacheRatio: totalTokens > 0 ? cacheReadTokens / totalTokens : 0,
    contextTokens: currentContextTokens,
    contextWindow,
    contextRatio: contextWindow > 0 ? currentContextTokens / contextWindow : 0,
    modelName: model?.name,
  };
}
