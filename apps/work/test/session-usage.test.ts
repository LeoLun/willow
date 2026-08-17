import type { ProviderInfo } from "@shared/api";
import { describe, expect, it } from "vitest";
import type { Message, MessageUsage } from "../src/renderer/src/components/message-list";
import { calculateSessionUsage } from "../src/renderer/src/components/session-usage";

const providers: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    apiKeyLabel: "API key",
    models: [
      {
        id: "gpt-5",
        name: "GPT-5",
        contextWindow: 200_000,
        thinkingLevels: [],
      },
      {
        id: "gpt-5-mini",
        name: "GPT-5 mini",
        contextWindow: 128_000,
        thinkingLevels: [],
      },
    ],
  },
];

function assistant(
  id: string,
  usage: Partial<MessageUsage>,
  overrides: Partial<Message> = {},
): Message {
  return {
    id,
    sourceKey: id,
    role: "assistant",
    timestamp: Number(id),
    status: "completed",
    content: [],
    provider: "openai",
    model: "gpt-5",
    stopReason: "stop",
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      ...usage,
    },
    ...overrides,
  };
}

describe("session usage", () => {
  it("aggregates tokens and uses the latest valid response for context", () => {
    const result = calculateSessionUsage(
      [
        assistant("1", { input: 20_000, output: 2_000, cacheRead: 8_000, totalTokens: 30_000 }),
        assistant(
          "2",
          { input: 10_000, output: 1_000, cacheRead: 4_000, totalTokens: 15_000 },
          { model: "gpt-5-mini", responseModel: "gpt-5-mini" },
        ),
      ],
      providers,
    );

    expect(result).toMatchObject({
      totalTokens: 45_000,
      cacheReadTokens: 12_000,
      cacheRatio: 12_000 / 45_000,
      contextTokens: 15_000,
      contextWindow: 128_000,
      contextRatio: 15_000 / 128_000,
      modelName: "GPT-5 mini",
    });
  });

  it("keeps cumulative usage but ignores failed responses for current context", () => {
    const result = calculateSessionUsage(
      [
        assistant("1", { totalTokens: 80_000 }),
        assistant("2", { totalTokens: 1_000 }, { stopReason: "error" }),
      ],
      providers,
    );

    expect(result.totalTokens).toBe(81_000);
    expect(result.contextTokens).toBe(80_000);
  });

  it("shows zero usage against the selected model for a new session", () => {
    expect(
      calculateSessionUsage([], providers, { providerId: "openai", modelId: "gpt-5" }),
    ).toMatchObject({
      totalTokens: 0,
      cacheRatio: 0,
      contextTokens: 0,
      contextWindow: 200_000,
      contextRatio: 0,
      modelName: "GPT-5",
    });
  });

  it("falls back to usage parts when totalTokens is unavailable", () => {
    const result = calculateSessionUsage(
      [assistant("1", { input: 5_000, output: 500, cacheRead: 2_000, cacheWrite: 100 })],
      providers,
    );

    expect(result.totalTokens).toBe(7_600);
    expect(result.contextTokens).toBe(7_600);
  });
});
