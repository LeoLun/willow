import { conversationContextStates } from "@main/db/schema";
import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { and, eq } from "drizzle-orm";

type ConversationContextStateInsert = typeof conversationContextStates.$inferInsert;

@Injectable()
export class ConversationContextStateDao {
  constructor(private readonly dbService: DbService) {}

  findBySessionAndModel(sessionId: number, modelId: string) {
    return this.dbService
      .getDb()
      .select()
      .from(conversationContextStates)
      .where(
        and(
          eq(conversationContextStates.sessionId, sessionId),
          eq(conversationContextStates.modelId, modelId),
        ),
      )
      .get();
  }

  upsertForSessionAndModel(data: Omit<ConversationContextStateInsert, "id">) {
    const existing = this.findBySessionAndModel(data.sessionId, data.modelId);
    if (existing) {
      return this.dbService
        .getDb()
        .update(conversationContextStates)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(conversationContextStates.id, existing.id))
        .returning()
        .get();
    }

    return this.dbService.getDb().insert(conversationContextStates).values(data).returning().get();
  }

  deleteBySessionId(sessionId: number) {
    return this.dbService
      .getDb()
      .delete(conversationContextStates)
      .where(eq(conversationContextStates.sessionId, sessionId))
      .returning()
      .all();
  }
}
