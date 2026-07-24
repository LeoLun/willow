// @vitest-environment jsdom

import type { GetStatisticsResponse, StatisticsGranularity } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick } from "vue";

const getStatistics = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", () => ({
  electronAPI: { getStatistics },
}));

vi.mock("@willow/shadcn/components/ui/tooltip", async () => {
  const { defineComponent, h } = await import("vue");
  const passthrough = defineComponent({
    setup(_, { slots }) {
      return () => h("div", slots.default?.());
    },
  });
  return {
    Tooltip: passthrough,
    TooltipContent: passthrough,
    TooltipProvider: passthrough,
    TooltipTrigger: passthrough,
  };
});

vi.mock("../src/renderer/src/components/dialog/setting/ProviderMark.vue", () => ({
  default: defineComponent({
    props: { name: String },
    setup(props) {
      return () => h("span", props.name);
    },
  }),
}));

import {
  getTokenHeatLevel,
  MAX_HEAT_LEVEL,
  TOKENS_PER_HEAT_LEVEL,
} from "../src/renderer/src/components/dialog/setting/statistics-heatmap";
import Statistics from "../src/renderer/src/components/dialog/setting/Statistics.vue";

const mountedApps: ReturnType<typeof createApp>[] = [];

function response(granularity: StatisticsGranularity, totalTokens: number): GetStatisticsResponse {
  return {
    granularity,
    summary: {
      totalTokens,
      cacheReadTokens: 0,
      totalTasks: totalTokens > 0 ? 1 : 0,
      totalCost: totalTokens > 0 ? 1 : 0,
    },
    activityBuckets: [
      {
        key: granularity,
        label: granularity,
        startAt: "2026-07-21T00:00:00.000Z",
        endAt: "2026-07-22T00:00:00.000Z",
        totalTokens,
        models: [],
      },
    ],
    modelUsage:
      totalTokens > 0
        ? [
            {
              providerId: "openai",
              providerName: "OpenAI",
              modelId: "gpt",
              modelName: "GPT",
              totalTokens,
              cacheReadTokens: 0,
              cacheRatio: 0,
              totalCost: 1,
              share: 1,
            },
          ]
        : [],
  };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mountStatistics() {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp(Statistics);
  app.mount(container);
  mountedApps.push(app);
  return container;
}

async function flushUi() {
  await Promise.resolve();
  await Promise.resolve();
  await nextTick();
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  getStatistics.mockReset();
});

describe("Statistics", () => {
  it.each([
    [0, 0],
    [1, 1],
    [1_000, 1],
    [10_000_000, 1],
    [10_000_001, 2],
    [90_000_001, 10],
    [100_000_000, 10],
    [200_000_000, 10],
  ])("maps %i tokens to fixed heat level %i", (tokens, level) => {
    expect(getTokenHeatLevel(tokens)).toBe(level);
    expect(TOKENS_PER_HEAT_LEVEL).toBe(10_000_000);
    expect(MAX_HEAT_LEVEL).toBe(10);
  });

  it("ignores stale responses when the aggregation changes quickly", async () => {
    const weekly = deferred<GetStatisticsResponse>();
    const all = deferred<GetStatisticsResponse>();
    getStatistics.mockImplementation(({ granularity }: { granularity: StatisticsGranularity }) => {
      if (granularity === "daily") return Promise.resolve(response("daily", 100));
      return granularity === "weekly" ? weekly.promise : all.promise;
    });
    const container = mountStatistics();
    await flushUi();

    const weeklyButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "每周",
    );
    weeklyButton?.click();
    await nextTick();
    const allButton = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "累计",
    );
    allButton?.click();
    await nextTick();
    all.resolve(response("all", 333));
    await flushUi();
    expect(container.textContent).toContain("333");

    weekly.resolve(response("weekly", 222));
    await flushUi();
    expect(container.textContent).toContain("333");
    expect(container.textContent).not.toContain("222");
  });

  it("renders an error and retries the active aggregation", async () => {
    getStatistics
      .mockRejectedValueOnce(new Error("failed"))
      .mockResolvedValueOnce(response("daily", 321));
    const container = mountStatistics();
    await flushUi();
    expect(container.textContent).toContain("无法读取统计数据");

    const retry = [...container.querySelectorAll("button")].find(
      (button) => button.textContent?.trim() === "重试",
    );
    retry?.click();
    await flushUi();
    expect(getStatistics).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("321");
  });

  it("renders the empty state for a new statistics database", async () => {
    getStatistics.mockResolvedValue(response("daily", 0));
    const container = mountStatistics();
    await flushUi();
    expect(container.textContent).toContain("完成一次任务后");
  });

  it("does not render fee information", async () => {
    getStatistics.mockResolvedValue(response("daily", 100));
    const container = mountStatistics();
    await flushUi();
    expect(container.textContent).not.toContain("费用");
    expect(container.textContent).not.toContain("$1.00");
  });
});
