// @vitest-environment jsdom

import type { ProviderInfo } from "@shared/api";
import { describe, expect, it } from "vitest";
import { createApp, h, nextTick, ref } from "vue";
import type { Message, MessageUsage } from "../src/renderer/src/components/message-list";
import {
  calculateSessionUsage,
  ContextUsageIndicator,
  formatPercent,
  formatTokenCount,
  SESSION_USAGE_KEY,
} from "../src/renderer/src/components/session-usage";

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

function user(id: string): Message {
  return {
    id,
    sourceKey: id,
    role: "user",
    timestamp: Number(id),
    status: "completed",
    content: [{ type: "text", text: "hello" }],
  };
}

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
  it("aggregates tokens, turns, steps, and uses the latest valid response for context", () => {
    const result = calculateSessionUsage(
      [
        user("1"),
        assistant("2", { input: 20_000, output: 2_000, cacheRead: 8_000, totalTokens: 30_000 }),
        user("3"),
        assistant(
          "4",
          { input: 10_000, output: 1_000, cacheRead: 4_000, totalTokens: 15_000 },
          { model: "gpt-5-mini", responseModel: "gpt-5-mini" },
        ),
      ],
      providers,
    );

    expect(result).toMatchObject({
      turns: 2,
      steps: 2,
      inputTokens: 30_000,
      outputTokens: 3_000,
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
        user("1"),
        assistant("2", { totalTokens: 80_000, input: 70_000, output: 10_000 }),
        assistant("3", { totalTokens: 1_000, input: 800, output: 200 }, { stopReason: "error" }),
      ],
      providers,
    );

    expect(result.turns).toBe(1);
    expect(result.steps).toBe(2);
    expect(result.inputTokens).toBe(70_800);
    expect(result.outputTokens).toBe(10_200);
    expect(result.totalTokens).toBe(81_000);
    expect(result.contextTokens).toBe(80_000);
  });

  it("shows zero usage against the selected model for a new session", () => {
    expect(
      calculateSessionUsage([], providers, { providerId: "openai", modelId: "gpt-5" }),
    ).toMatchObject({
      turns: 0,
      steps: 0,
      inputTokens: 0,
      outputTokens: 0,
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

  it("formats token counts and percentages correctly", () => {
    expect(formatTokenCount(161)).toBe("161");
    expect(formatTokenCount(7700)).toBe("7.7K");
    expect(formatTokenCount(20000)).toBe("20K");
    expect(formatTokenCount(1200000)).toBe("1.2M");

    expect(formatPercent(0)).toBe("0%");
    expect(formatPercent(0.256)).toBe("26%");
    expect(formatPercent(1)).toBe("100%");
  });

  it("renders ContextUsageIndicator with context progress and label", async () => {
    const container = document.createElement("div");
    document.body.append(container);

    const usage = ref({
      turns: 1,
      steps: 1,
      inputTokens: 7700,
      outputTokens: 161,
      totalTokens: 7861,
      cacheReadTokens: 0,
      cacheRatio: 0,
      contextTokens: 7861,
      contextWindow: 128_000,
      contextRatio: 7861 / 128_000,
    });

    const app = createApp({
      provide: {
        [SESSION_USAGE_KEY as symbol]: usage,
      },
      render: () => h(ContextUsageIndicator),
    });
    app.mount(container);
    await nextTick();

    const indicator = container.querySelector<HTMLElement>("[data-slot=context-usage-indicator]");
    expect(indicator).not.toBeNull();
    expect(indicator?.getAttribute("aria-label")).toContain("上下文大小: 7.9K / 128K (6%)");
    expect(indicator?.getAttribute("role")).toBe("progressbar");

    app.unmount();
    container.remove();
  });
});
