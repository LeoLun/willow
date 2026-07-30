import { Injectable } from "@willow/poetry";
import { asc } from "drizzle-orm";
import type {
  NewStatisticsRun,
  NewStatisticsUsage,
  StatisticsRun,
  StatisticsUsage,
} from "../../db/schema";
import { statisticsRuns, statisticsUsage } from "../../db/schema";
import { DbService } from "../db.service";

export type CreateStatisticsRunInput = Pick<
  NewStatisticsRun,
  "source" | "workspaceId" | "sessionId" | "startedAt"
>;

export type CreateStatisticsUsageInput = Omit<NewStatisticsUsage, "id">;

@Injectable()
export class StatisticsDao {
  constructor(private readonly dbService: DbService) {}

  createRun(input: CreateStatisticsRunInput): StatisticsRun {
    return this.dbService.getDb().insert(statisticsRuns).values(input).returning().get();
  }

  createUsage(input: CreateStatisticsUsageInput): StatisticsUsage {
    return this.dbService.getDb().insert(statisticsUsage).values(input).returning().get();
  }

  findAllRuns(): StatisticsRun[] {
    return this.dbService
      .getDb()
      .select()
      .from(statisticsRuns)
      .orderBy(asc(statisticsRuns.startedAt))
      .all();
  }

  findAllUsage(): StatisticsUsage[] {
    return this.dbService
      .getDb()
      .select()
      .from(statisticsUsage)
      .orderBy(asc(statisticsUsage.occurredAt))
      .all();
  }
}
