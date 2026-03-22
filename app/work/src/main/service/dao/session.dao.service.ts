import { Injectable } from "@willow/poetry";
import { eq, inArray } from "drizzle-orm";
import { DbService } from "@main/service/db.service";
import { sessions } from "../../db/schema";

type SessionInsert = typeof sessions.$inferInsert;

@Injectable()
export class SessionDao {
  constructor(private readonly dbService: DbService) {}

  findAll() {
    return this.dbService.getDb().select().from(sessions).all();
  }

  findById(id: number) {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .get();
  }

  findByWorkspaceId(workspaceId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.workspaceId, workspaceId))
      .all();
  }

  insert(data: Omit<SessionInsert, "id">) {
    return this.dbService
      .getDb()
      .insert(sessions)
      .values(data)
      .returning()
      .get();
  }

  update(id: number, data: Partial<Omit<SessionInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(sessions)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning()
      .get();
  }

  deleteById(id: number) {
    return this.dbService
      .getDb()
      .delete(sessions)
      .where(eq(sessions.id, id))
      .returning()
      .get();
  }

  findByWorkspaceIds(workspaceIds: number[]) {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(inArray(sessions.workspaceId, workspaceIds))
      .all();
  }
}
