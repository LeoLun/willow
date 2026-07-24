import "reflect-metadata";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { StatisticsRun, StatisticsUsage } from "../src/main/db/schema";
import type { StatisticsDao } from "../src/main/service/dao/statistics.dao.server";
import { StatisticsService } from "../src/main/service/statistics.service";

function run(overrides: Partial<StatisticsRun> = {}): StatisticsRun {
  return {
    id: 1,
    source: "chat",
    workspaceId: 1,
    sessionId: "session",
    startedAt: new Date("2026-07-24T00:00:00.000Z"),
    ...overrides,
  };
}

function usage(overrides: Partial<StatisticsUsage> = {}): StatisticsUsage {
  return {
    id: 1,
    runId: 1,
    providerId: "openai",
    providerName: "OpenAI",
    modelId: "gpt",
    modelName: "GPT",
    inputTokens: 40,
    outputTokens: 20,
    cacheReadTokens: 30,
    cacheWriteTokens: 10,
    totalTokens: 100,
    inputCost: 0.1,
    outputCost: 0.2,
    cacheReadCost: 0.03,
    cacheWriteCost: 0.04,
    totalCost: 0.37,
    occurredAt: new Date("2026-07-24T12:00:00.000Z"),
    ...overrides,
  };
}

describe("StatisticsService", () => {
  const createRun = vi.fn<StatisticsDao["createRun"]>();
  const createUsage = vi.fn<StatisticsDao["createUsage"]>();
  const findAllRuns = vi.fn<StatisticsDao["findAllRuns"]>();
  const findAllUsage = vi.fn<StatisticsDao["findAllUsage"]>();
  const dao = {
    createRun,
    createUsage,
    findAllRuns,
    findAllUsage,
  } as unknown as StatisticsDao;
  let service: StatisticsService;

  beforeEach(() => {
    service = new StatisticsService(dao);
    findAllRuns.mockReturnValue([]);
    findAllUsage.mockReturnValue([]);
  });

  it("persists run context and the complete assistant usage payload", () => {
    createRun.mockReturnValue(run({ id: 7, source: "title" }));
    const startedAt = new Date("2026-07-24T01:00:00.000Z");

    expect(
      service.startRun({
        source: "title",
        workspaceId: 2,
        sessionId: "title-session",
        startedAt,
      }),
    ).toBe(7);
    expect(createRun).toHaveBeenCalledWith({
      source: "title",
      workspaceId: 2,
      sessionId: "title-session",
      startedAt,
    });

    const message = {
      role: "assistant",
      provider: "openai",
      model: "requested-model",
      responseModel: "served-model",
      content: [],
      usage: {
        input: 40,
        output: 20,
        cacheRead: 30,
        cacheWrite: 10,
        totalTokens: 100,
        cost: { input: 0.1, output: 0.2, cacheRead: 0.03, cacheWrite: 0.04, total: 0.37 },
      },
      stopReason: "stop",
      timestamp: Date.parse("2026-07-24T02:00:00.000Z"),
    } as AssistantMessage;
    service.recordUsage({
      runId: 7,
      message,
      providerName: "OpenAI",
      modelName: "Served Model",
    });

    expect(createUsage).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 7,
        providerId: "openai",
        modelId: "served-model",
        modelName: "Served Model",
        inputTokens: 40,
        outputTokens: 20,
        cacheReadTokens: 30,
        cacheWriteTokens: 10,
        totalTokens: 100,
        totalCost: 0.37,
        occurredAt: new Date("2026-07-24T02:00:00.000Z"),
      }),
    );
  });

  it("summarizes all usage while counting only chat runs as tasks", () => {
    findAllRuns.mockReturnValue([
      run({ id: 1, source: "chat" }),
      run({ id: 2, source: "title" }),
      run({ id: 3, source: "chat" }),
    ]);
    findAllUsage.mockReturnValue([
      usage(),
      usage({
        id: 2,
        providerId: "anthropic",
        providerName: "Anthropic",
        modelId: "claude",
        modelName: "Claude",
        totalTokens: 300,
        cacheReadTokens: 0,
        totalCost: 0.9,
      }),
      usage({ id: 3, totalTokens: 0, cacheReadTokens: 0, totalCost: 0 }),
    ]);

    const result = service.getStatistics("all", new Date("2026-07-25T00:00:00.000Z"));

    expect(result.summary).toEqual({
      totalTokens: 400,
      cacheReadTokens: 30,
      totalTasks: 2,
      totalCost: 1.27,
    });
    expect(result.modelUsage.map((item) => item.modelId)).toEqual(["claude", "gpt"]);
    expect(result.modelUsage[0]).toMatchObject({ share: 0.75, cacheRatio: 0 });
    expect(result.modelUsage[1]).toMatchObject({ share: 0.25, cacheRatio: 0.3 });
    expect(result.activityBuckets).toHaveLength(1);
    expect(result.activityBuckets[0].totalTokens).toBe(400);
  });

  it("creates deterministic daily and UTC-week buckets with range boundaries", () => {
    findAllUsage.mockReturnValue([
      usage({ id: 1, occurredAt: new Date("2025-07-25T23:59:59.000Z"), totalTokens: 5 }),
      usage({ id: 2, occurredAt: new Date("2025-07-26T00:00:00.000Z"), totalTokens: 10 }),
      usage({ id: 3, occurredAt: new Date("2026-07-24T23:59:59.000Z"), totalTokens: 20 }),
    ]);
    const now = new Date("2026-07-24T15:00:00.000Z");

    const daily = service.getStatistics("daily", now);
    expect(daily.activityBuckets).toHaveLength(365);
    expect(daily.activityBuckets[0]).toMatchObject({ key: "2025-07-25", totalTokens: 5 });
    expect(daily.activityBuckets.at(-1)).toMatchObject({
      key: "2026-07-24",
      totalTokens: 20,
    });

    const weekly = service.getStatistics("weekly", now);
    expect(weekly.activityBuckets).toHaveLength(52);
    expect(weekly.activityBuckets.at(-1)?.key).toBe("2026-07-20");
    expect(weekly.activityBuckets.at(-1)?.totalTokens).toBe(20);
  });

  it("returns zeroed summaries and empty model usage for a new database", () => {
    const result = service.getStatistics("daily", new Date("2026-07-24T00:00:00.000Z"));
    expect(result.summary).toEqual({
      totalTokens: 0,
      cacheReadTokens: 0,
      totalTasks: 0,
      totalCost: 0,
    });
    expect(result.modelUsage).toEqual([]);
    expect(result.activityBuckets).toHaveLength(365);
    expect(result.activityBuckets.every((bucket) => bucket.totalTokens === 0)).toBe(true);
  });
});
