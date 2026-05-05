import type { AgentMessage } from "@mariozechner/pi-agent-core";
import { isUserLikeMessage } from "./agent-message-text";
import {
  calculateContextBudget,
  estimateAgentMessageTokens,
  estimateAgentMessagesTokens,
  estimateTextTokens,
  type ContextBudget,
} from "./context-token-estimator";

export interface ContextMessageEntry {
  id?: number;
  message: AgentMessage;
}

export interface ContextWindowPlanInput {
  entries: ContextMessageEntry[];
  contextWindow: number;
  maxTokens: number;
  currentInput: string;
  systemTokens?: number;
  summaryText?: string;
  compressedUntilMessageId?: number | null;
  forceSummaryWindow?: boolean;
  preferredRecentRounds?: number;
  minimumRecentRounds?: number;
}

export interface ContextWindowPlan {
  shouldCompress: boolean;
  shouldUseSummary: boolean;
  messagesToCompress: ContextMessageEntry[];
  recentMessages: ContextMessageEntry[];
  preservedMessages: ContextMessageEntry[];
  budget: ContextBudget;
  plannedInputTokens: number;
  degradationReason?: "recent-window-too-large" | "nothing-to-compress";
}

interface MessageRound {
  entries: ContextMessageEntry[];
}

function splitIntoRounds(entries: ContextMessageEntry[]): MessageRound[] {
  const rounds: MessageRound[] = [];
  let current: ContextMessageEntry[] = [];

  for (const entry of entries) {
    if (isUserLikeMessage(entry.message) && current.length > 0) {
      rounds.push({ entries: current });
      current = [];
    }
    current.push(entry);
  }

  if (current.length > 0) {
    rounds.push({ entries: current });
  }

  return rounds;
}

function flattenRounds(rounds: MessageRound[]): ContextMessageEntry[] {
  return rounds.flatMap((round) => round.entries);
}

function estimateEntriesTokens(entries: ContextMessageEntry[]): number {
  return entries.reduce((total, entry) => total + estimateAgentMessageTokens(entry.message), 0);
}

export function planContextMessageWindow(input: ContextWindowPlanInput): ContextWindowPlan {
  const summaryText = input.summaryText?.trim() ?? "";
  const summaryTokens = summaryText ? estimateTextTokens(summaryText) : 0;
  const currentInputTokens = estimateTextTokens(input.currentInput);
  const historyTokens = estimateAgentMessagesTokens(input.entries.map((entry) => entry.message));
  const budget = calculateContextBudget({
    contextWindow: input.contextWindow,
    maxTokens: input.maxTokens,
    systemTokens: input.systemTokens ?? 0,
    summaryTokens,
    historyTokens,
    currentInputTokens,
  });
  const hasSummary = summaryText.length > 0;
  const shouldCompress =
    budget.totalInputTokens > budget.triggerThreshold ||
    budget.totalInputTokens > budget.usableContext;

  if (!shouldCompress && !input.forceSummaryWindow && !hasSummary) {
    return {
      shouldCompress: false,
      shouldUseSummary: false,
      messagesToCompress: [],
      recentMessages: input.entries,
      preservedMessages: [],
      budget,
      plannedInputTokens: budget.totalInputTokens,
    };
  }

  const preferredRecentRounds = input.preferredRecentRounds ?? 5;
  const minimumRecentRounds = input.minimumRecentRounds ?? 3;
  const rounds = splitIntoRounds(input.entries);
  let recentRoundCount = Math.min(preferredRecentRounds, rounds.length);
  let recentRounds = rounds.slice(rounds.length - recentRoundCount);
  let recentMessages = flattenRounds(recentRounds);
  let plannedInputTokens =
    (input.systemTokens ?? 0) +
    summaryTokens +
    estimateEntriesTokens(recentMessages) +
    currentInputTokens;

  while (recentRoundCount > minimumRecentRounds && plannedInputTokens > budget.targetBudget) {
    recentRoundCount -= 1;
    recentRounds = rounds.slice(rounds.length - recentRoundCount);
    recentMessages = flattenRounds(recentRounds);
    plannedInputTokens =
      (input.systemTokens ?? 0) +
      summaryTokens +
      estimateEntriesTokens(recentMessages) +
      currentInputTokens;
  }

  if (plannedInputTokens > budget.triggerThreshold && recentMessages.length > 1) {
    recentMessages = [recentMessages[recentMessages.length - 1]];
    plannedInputTokens =
      (input.systemTokens ?? 0) +
      summaryTokens +
      estimateEntriesTokens(recentMessages) +
      currentInputTokens;
  }

  const firstRecent = recentMessages[0];
  const firstRecentIndex = firstRecent ? input.entries.indexOf(firstRecent) : input.entries.length;
  const preservedMessages = input.entries.slice(0, Math.max(0, firstRecentIndex));
  const compressedUntil = input.compressedUntilMessageId ?? null;
  const messagesToCompress = preservedMessages.filter((entry) => {
    if (entry.id === undefined || compressedUntil === null) {
      return true;
    }
    return entry.id > compressedUntil;
  });

  let degradationReason: ContextWindowPlan["degradationReason"];
  if (shouldCompress && messagesToCompress.length === 0 && !hasSummary) {
    degradationReason = "nothing-to-compress";
  } else if (plannedInputTokens > budget.triggerThreshold) {
    degradationReason = "recent-window-too-large";
  }

  return {
    shouldCompress,
    shouldUseSummary: hasSummary || shouldCompress || input.forceSummaryWindow === true,
    messagesToCompress,
    recentMessages,
    preservedMessages,
    budget,
    plannedInputTokens,
    degradationReason,
  };
}
