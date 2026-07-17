import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { Injectable } from "@willow/poetry";
import { and, asc, desc, eq } from "drizzle-orm";
import type { NewSession, Session, SessionEntry } from "../../db/schema";
import { sessionEntries, sessions } from "../../db/schema";
import { DbService } from "../db.service";

export type CreateSessionInput = Pick<NewSession, "workspaceId" | "title" | "agentSessionId">;
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

  findByAgentSessionId(agentSessionId: string): Session | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(eq(sessions.agentSessionId, agentSessionId))
      .get();
  }

  findByAgentSessionIdAndWorkspaceId(
    agentSessionId: string,
    workspaceId: number,
  ): Session | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(sessions)
      .where(
        and(eq(sessions.agentSessionId, agentSessionId), eq(sessions.workspaceId, workspaceId)),
      )
      .get();
  }

  create(input: CreateSessionInput): Session {
    return this.dbService.getDb().insert(sessions).values(input).returning().get();
  }

  createWithEntries(input: CreateSessionInput, entries: readonly SessionTreeEntry[]): Session {
    return this.dbService.getDb().transaction((transaction) => {
      const session = transaction.insert(sessions).values(input).returning().get();
      if (entries.length > 0) {
        transaction
          .insert(sessionEntries)
          .values(
            entries.map((entry) => ({
              sessionId: session.id,
              entryId: entry.id,
              entryType: entry.type,
              payload: entry,
            })),
          )
          .run();
      }
      return session;
    });
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

  findEntries(sessionId: number): SessionEntry[] {
    return this.dbService
      .getDb()
      .select()
      .from(sessionEntries)
      .where(eq(sessionEntries.sessionId, sessionId))
      .orderBy(asc(sessionEntries.id))
      .all();
  }

  findEntriesByType<TType extends SessionTreeEntry["type"]>(
    sessionId: number,
    type: TType,
  ): Array<SessionEntry & { payload: Extract<SessionTreeEntry, { type: TType }> }> {
    return this.dbService
      .getDb()
      .select()
      .from(sessionEntries)
      .where(and(eq(sessionEntries.sessionId, sessionId), eq(sessionEntries.entryType, type)))
      .orderBy(asc(sessionEntries.id))
      .all() as Array<SessionEntry & { payload: Extract<SessionTreeEntry, { type: TType }> }>;
  }

  findEntry(sessionId: number, entryId: string): SessionEntry | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(sessionEntries)
      .where(and(eq(sessionEntries.sessionId, sessionId), eq(sessionEntries.entryId, entryId)))
      .get();
  }

  appendEntry(sessionId: number, entry: SessionTreeEntry): void {
    this.dbService.getDb().transaction((transaction) => {
      transaction
        .insert(sessionEntries)
        .values({
          sessionId,
          entryId: entry.id,
          entryType: entry.type,
          payload: entry,
        })
        .run();
      transaction
        .update(sessions)
        .set({ updatedAt: new Date() })
        .where(eq(sessions.id, sessionId))
        .run();
    });
  }
}
