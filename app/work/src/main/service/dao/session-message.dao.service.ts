import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { asc, eq, inArray } from "drizzle-orm";
import { sessionMessages } from "../../db/schema";

type SessionMessageInsert = typeof sessionMessages.$inferInsert;

@Injectable()
export class SessionMessageDao {
  constructor(private readonly dbService: DbService) {}

  findAll() {
    return this.dbService.getDb().select().from(sessionMessages).all();
  }

  findById(id: number) {
    return this.dbService
      .getDb()
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.id, id))
      .get();
  }

  findBySessionId(sessionId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .orderBy(asc(sessionMessages.id))
      .all();
  }

  findByGroupId(groupId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(sessionMessages)
      .where(eq(sessionMessages.groupId, groupId))
      .all();
  }

  insert(data: Omit<SessionMessageInsert, "id">) {
    return this.dbService.getDb().insert(sessionMessages).values(data).returning().get();
  }

  insertMany(data: Omit<SessionMessageInsert, "id">[]) {
    return this.dbService.getDb().insert(sessionMessages).values(data).returning().all();
  }

  update(id: number, data: Partial<Omit<SessionMessageInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(sessionMessages)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sessionMessages.id, id))
      .returning()
      .get();
  }

  deleteById(id: number) {
    return this.dbService
      .getDb()
      .delete(sessionMessages)
      .where(eq(sessionMessages.id, id))
      .returning()
      .get();
  }

  deleteBySessionId(sessionId: number) {
    return this.dbService
      .getDb()
      .delete(sessionMessages)
      .where(eq(sessionMessages.sessionId, sessionId))
      .returning()
      .all();
  }

  deleteBySessionIds(sessionIds: number[]) {
    if (sessionIds.length === 0) return [];
    return this.dbService
      .getDb()
      .delete(sessionMessages)
      .where(inArray(sessionMessages.sessionId, sessionIds))
      .returning()
      .all();
  }
}
