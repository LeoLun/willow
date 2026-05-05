import type { AgentMessage } from "@mariozechner/pi-agent-core";

const MESSAGE_OVERHEAD_TOKENS = 12;
const MIN_RESERVED_OUTPUT_TOKENS = 1024;

export interface ContextBudgetInput {
  contextWindow: number;
  maxTokens: number;
  systemTokens?: number;
  summaryTokens?: number;
  historyTokens: number;
  currentInputTokens: number;
}

export interface ContextBudget {
  contextWindow: number;
  reservedOutputTokens: number;
  usableContext: number;
  triggerThreshold: number;
  targetBudget: number;
  totalInputTokens: number;
}

export function estimateTextTokens(text: string): number {
  let tokens = 0;
  let asciiRun = 0;

  for (const char of text) {
    if (char.charCodeAt(0) <= 0x7f) {
      asciiRun += 1;
      continue;
    }
    if (asciiRun > 0) {
      tokens += Math.ceil(asciiRun / 4);
      asciiRun = 0;
    }
    tokens += 1;
  }

  if (asciiRun > 0) {
    tokens += Math.ceil(asciiRun / 4);
  }

  return Math.max(1, tokens);
}

export function estimateAgentMessageTokens(message: AgentMessage): number {
  return estimateTextTokens(JSON.stringify(message)) + MESSAGE_OVERHEAD_TOKENS;
}

export function estimateAgentMessagesTokens(messages: AgentMessage[]): number {
  return messages.reduce((total, message) => total + estimateAgentMessageTokens(message), 0);
}

export function calculateContextBudget(input: ContextBudgetInput): ContextBudget {
  const reservedOutputTokens = Math.min(
    Math.max(input.maxTokens, MIN_RESERVED_OUTPUT_TOKENS),
    Math.floor(input.contextWindow * 0.4),
  );
  const usableContext = Math.max(1, input.contextWindow - reservedOutputTokens);
  const totalInputTokens =
    (input.systemTokens ?? 0) +
    (input.summaryTokens ?? 0) +
    input.historyTokens +
    input.currentInputTokens;

  return {
    contextWindow: input.contextWindow,
    reservedOutputTokens,
    usableContext,
    triggerThreshold: Math.floor(usableContext * 0.8),
    targetBudget: Math.floor(usableContext * 0.6),
    totalInputTokens,
  };
}
