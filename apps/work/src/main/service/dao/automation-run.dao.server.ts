import { Injectable } from "@willow/poetry";
import { and, desc, eq, lt, or } from "drizzle-orm";
import type { AutomationRun, NewAutomationRun } from "../../db/schema";
import { automationRuns, sessions } from "../../db/schema";
import { DbService } from "../db.service";

export type CreateRunInput = Pick<
  NewAutomationRun,
  "automationId" | "runKind" | "status" | "scheduledFor" | "triggeredAt" | "errorMessage"
>;

export type FinishRunInput = Partial<{
  status: AutomationRun["status"];
  finishedAt: Date;
  errorMessage: string | null;
}>;

export type AutomationRunWithAgentSession = AutomationRun & {
  agentSessionId: string | null;
};

@Injectable()
export class AutomationRunDao {
  constructor(private readonly dbService: DbService) {}

  create(input: CreateRunInput): AutomationRun {
    return this.dbService.getDb().insert(automationRuns).values(input).returning().get();
  }

  findById(id: number): AutomationRun | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.id, id))
      .get();
  }

  findLatestByAutomation(automationId: number): AutomationRun | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automationId))
      .orderBy(desc(automationRuns.triggeredAt), desc(automationRuns.id))
      .limit(1)
      .get();
  }

  findByIdWithAgentSession(id: number): AutomationRunWithAgentSession | undefined {
    const row = this.dbService
      .getDb()
      .select({
        run: automationRuns,
        agentSessionId: sessions.agentSessionId,
      })
      .from(automationRuns)
      .leftJoin(sessions, eq(sessions.id, automationRuns.sessionId))
      .where(eq(automationRuns.id, id))
      .get();
    if (!row) return undefined;
    return { ...row.run, agentSessionId: row.agentSessionId };
  }

  updateSessionId(id: number, sessionId: number | null): AutomationRun | undefined {
    return this.dbService
      .getDb()
      .update(automationRuns)
      .set({ sessionId })
      .where(eq(automationRuns.id, id))
      .returning()
      .get();
  }

  finish(id: number, input: FinishRunInput): AutomationRun | undefined {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }
    return this.dbService
      .getDb()
      .update(automationRuns)
      .set(input)
      .where(eq(automationRuns.id, id))
      .returning()
      .get();
  }

  markAutomationRunningInterrupted(
    automationId: number,
    finishedAt: Date,
    message: string,
  ): number {
    return this.dbService
      .getDb()
      .update(automationRuns)
      .set({ status: "interrupted", finishedAt, errorMessage: message })
      .where(
        and(eq(automationRuns.automationId, automationId), eq(automationRuns.status, "running")),
      )
      .run().changes;
  }

  markAllRunningInterrupted(finishedAt: Date, message: string): number {
    return this.dbService
      .getDb()
      .update(automationRuns)
      .set({ status: "interrupted", finishedAt, errorMessage: message })
      .where(eq(automationRuns.status, "running"))
      .run().changes;
  }

  hasRunning(automationId: number): boolean {
    const row = this.dbService
      .getDb()
      .select({ id: automationRuns.id })
      .from(automationRuns)
      .where(
        and(eq(automationRuns.automationId, automationId), eq(automationRuns.status, "running")),
      )
      .get();
    return row !== undefined;
  }

  listByAutomation(
    automationId: number,
    options: { cursor?: number; limit: number },
  ): AutomationRunWithAgentSession[] {
    const { cursor, limit } = options;
    let cursorTriggeredAt: Date | undefined;
    if (cursor !== undefined) {
      const cursorRun = this.findById(cursor);
      if (!cursorRun || cursorRun.automationId !== automationId) {
        return [];
      }
      cursorTriggeredAt = cursorRun.triggeredAt;
    }

    const conditions = [eq(automationRuns.automationId, automationId)];
    if (cursor !== undefined && cursorTriggeredAt !== undefined) {
      conditions.push(
        or(
          lt(automationRuns.triggeredAt, cursorTriggeredAt),
          and(eq(automationRuns.triggeredAt, cursorTriggeredAt), lt(automationRuns.id, cursor!)),
        )!,
      );
    }

    return this.dbService
      .getDb()
      .select({
        run: automationRuns,
        agentSessionId: sessions.agentSessionId,
      })
      .from(automationRuns)
      .leftJoin(sessions, eq(sessions.id, automationRuns.sessionId))
      .where(and(...conditions))
      .orderBy(desc(automationRuns.triggeredAt), desc(automationRuns.id))
      .limit(limit)
      .all()
      .map(({ run, agentSessionId }) => ({ ...run, agentSessionId }));
  }
}
