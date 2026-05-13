import { sessionContextSummaries } from "@main/db/schema";
import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { and, eq } from "drizzle-orm";

type SessionContextSummaryInsert = typeof sessionContextSummaries.$inferInsert;

@Injectable()
export class SessionContextSummaryDao {
  constructor(private readonly dbService: DbService) {}

  findBySessionAndModel(sessionId: number, modelId: string) {
    return this.dbService
      .getDb()
      .select()
      .from(sessionContextSummaries)
      .where(
        and(
          eq(sessionContextSummaries.sessionId, sessionId),
          eq(sessionContextSummaries.modelId, modelId),
        ),
      )
      .get();
  }

  upsertForSessionAndModel(data: Omit<SessionContextSummaryInsert, "id">) {
    const existing = this.findBySessionAndModel(data.sessionId, data.modelId);
    if (existing) {
      return this.dbService
        .getDb()
        .update(sessionContextSummaries)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(sessionContextSummaries.id, existing.id))
        .returning()
        .get();
    }

    return this.dbService.getDb().insert(sessionContextSummaries).values(data).returning().get();
  }

  deleteBySessionId(sessionId: number) {
    return this.dbService
      .getDb()
      .delete(sessionContextSummaries)
      .where(eq(sessionContextSummaries.sessionId, sessionId))
      .returning()
      .all();
  }
}
