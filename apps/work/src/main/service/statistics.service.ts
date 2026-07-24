import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  GetStatisticsResponse,
  StatisticsActivityBucket,
  StatisticsGranularity,
  StatisticsModelUsage,
} from "@shared/api";
import { Injectable } from "@willow/poetry";
import type { StatisticsRunSource, StatisticsUsage } from "../db/schema";
import { StatisticsDao } from "./dao/statistics.dao.server";

export interface StartStatisticsRunInput {
  source: StatisticsRunSource;
  workspaceId?: number;
  sessionId?: string;
  startedAt?: Date;
}

export interface RecordStatisticsUsageInput {
  runId: number;
  message: AssistantMessage;
  providerName: string;
  modelName: string;
}

type MutableUsageAggregate = {
  providerId: string;
  providerName: string;
  modelId: string;
  modelName: string;
  totalTokens: number;
  cacheReadTokens: number;
  totalCost: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfUtcWeek(value: Date): Date {
  const day = startOfUtcDay(value);
  const daysSinceMonday = (day.getUTCDay() + 6) % 7;
  return new Date(day.getTime() - daysSinceMonday * DAY_MS);
}

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function modelKey(providerId: string, modelId: string): string {
  return JSON.stringify([providerId, modelId]);
}

@Injectable()
export class StatisticsService {
  constructor(private readonly statisticsDao: StatisticsDao) {}

  startRun(input: StartStatisticsRunInput): number {
    return this.statisticsDao.createRun({
      source: input.source,
      workspaceId: input.workspaceId,
      sessionId: input.sessionId,
      startedAt: input.startedAt ?? new Date(),
    }).id;
  }

  recordUsage(input: RecordStatisticsUsageInput): void {
    const { message } = input;
    this.statisticsDao.createUsage({
      runId: input.runId,
      providerId: message.provider,
      providerName: input.providerName,
      modelId: message.responseModel ?? message.model,
      modelName: input.modelName,
      inputTokens: message.usage.input,
      outputTokens: message.usage.output,
      cacheReadTokens: message.usage.cacheRead,
      cacheWriteTokens: message.usage.cacheWrite,
      totalTokens: message.usage.totalTokens,
      inputCost: message.usage.cost.input,
      outputCost: message.usage.cost.output,
      cacheReadCost: message.usage.cost.cacheRead,
      cacheWriteCost: message.usage.cost.cacheWrite,
      totalCost: message.usage.cost.total,
      occurredAt: new Date(message.timestamp),
    });
  }

  getStatistics(granularity: StatisticsGranularity, now = new Date()): GetStatisticsResponse {
    const runs = this.statisticsDao.findAllRuns();
    const usage = this.statisticsDao.findAllUsage();
    const totalTokens = usage.reduce((sum, item) => sum + item.totalTokens, 0);
    const cacheReadTokens = usage.reduce((sum, item) => sum + item.cacheReadTokens, 0);
    const totalCost = usage.reduce((sum, item) => sum + item.totalCost, 0);

    return {
      granularity,
      summary: {
        totalTokens,
        cacheReadTokens,
        totalTasks: runs.filter((run) => run.source === "chat").length,
        totalCost,
      },
      activityBuckets: this.buildActivityBuckets(granularity, usage, now),
      modelUsage: this.buildModelUsage(usage, totalTokens),
    };
  }

  private buildModelUsage(usage: StatisticsUsage[], allTokens: number): StatisticsModelUsage[] {
    const aggregates = this.aggregateByModel(usage);
    return [...aggregates.values()]
      .sort((left, right) => right.totalTokens - left.totalTokens)
      .map((item) => ({
        ...item,
        cacheRatio: item.totalTokens === 0 ? 0 : item.cacheReadTokens / item.totalTokens,
        share: allTokens === 0 ? 0 : item.totalTokens / allTokens,
      }));
  }

  private buildActivityBuckets(
    granularity: StatisticsGranularity,
    usage: StatisticsUsage[],
    now: Date,
  ): StatisticsActivityBucket[] {
    if (granularity === "all") {
      return [this.createBucket("all", "累计", usage, usage[0]?.occurredAt ?? now, now)];
    }

    const bucketCount = granularity === "daily" ? 365 : 52;
    const bucketDuration = granularity === "daily" ? DAY_MS : WEEK_MS;
    const currentStart = granularity === "daily" ? startOfUtcDay(now) : startOfUtcWeek(now);
    const firstStart = new Date(currentStart.getTime() - (bucketCount - 1) * bucketDuration);

    return Array.from({ length: bucketCount }, (_, index) => {
      const start = new Date(firstStart.getTime() + index * bucketDuration);
      const end = new Date(start.getTime() + bucketDuration);
      const bucketUsage = usage.filter((item) => item.occurredAt >= start && item.occurredAt < end);
      const label =
        granularity === "daily"
          ? dateKey(start)
          : `${dateKey(start)} - ${dateKey(new Date(end.getTime() - DAY_MS))}`;
      return this.createBucket(dateKey(start), label, bucketUsage, start, end);
    });
  }

  private createBucket(
    key: string,
    label: string,
    usage: StatisticsUsage[],
    start: Date,
    end: Date,
  ): StatisticsActivityBucket {
    const models = [...this.aggregateByModel(usage).values()]
      .sort((left, right) => right.totalTokens - left.totalTokens)
      .map((item) => ({
        providerId: item.providerId,
        modelId: item.modelId,
        modelName: item.modelName,
        tokens: item.totalTokens,
      }));

    return {
      key,
      label,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      totalTokens: usage.reduce((sum, item) => sum + item.totalTokens, 0),
      models,
    };
  }

  private aggregateByModel(usage: StatisticsUsage[]): Map<string, MutableUsageAggregate> {
    const aggregates = new Map<string, MutableUsageAggregate>();
    for (const item of usage) {
      const key = modelKey(item.providerId, item.modelId);
      const current = aggregates.get(key) ?? {
        providerId: item.providerId,
        providerName: item.providerName,
        modelId: item.modelId,
        modelName: item.modelName,
        totalTokens: 0,
        cacheReadTokens: 0,
        totalCost: 0,
      };
      current.totalTokens += item.totalTokens;
      current.cacheReadTokens += item.cacheReadTokens;
      current.totalCost += item.totalCost;
      aggregates.set(key, current);
    }
    return aggregates;
  }
}
