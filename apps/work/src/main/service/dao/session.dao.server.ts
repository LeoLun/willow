import { Injectable } from "@willow/poetry";
import { desc, eq } from "drizzle-orm";
import type { NewSession, Session } from "../../db/schema";
import { sessions } from "../../db/schema";
import { DbService } from "../db.service";

export type CreateSessionInput = Pick<NewSession, "workspaceId" | "title" | "agentSessionPath">;
export type UpdateSessionInput = Partial<CreateSessionInput>;

@Injectable()
export class SessionDao {
  constructor(private readonly dbService: DbService) {}

  findAll(): Session[] {
    return this.dbService.getDb().select().from(sessions).orderBy(desc(sessions.updatedAt)).all();
  }

  findById(id: number): Session | undefined {
    return this.dbService.getDb().select().from(sessions).where(eq(sessions.id, id)).get();
  }

  findByWorkspaceId(workspaceId: number): Session[] {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.workspaceId, workspaceId))
      .orderBy(desc(sessions.updatedAt))
      .all();
  }

  findByAgentSessionPath(agentSessionPath: string): Session | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.agentSessionPath, agentSessionPath))
      .get();
  }

  create(input: CreateSessionInput): Session {
    return this.dbService.getDb().insert(sessions).values(input).returning().get();
  }

  update(id: number, input: UpdateSessionInput): Session | undefined {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }

    return this.dbService
      .getDb()
      .update(sessions)
      .set(input)
      .where(eq(sessions.id, id))
      .returning()
      .get();
  }

  delete(id: number): boolean {
    return this.dbService.getDb().delete(sessions).where(eq(sessions.id, id)).run().changes > 0;
  }
}
