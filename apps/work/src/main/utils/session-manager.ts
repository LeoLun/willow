import {
  getEntriesToFork,
  SessionError,
  toSession,
  uuidv7,
  type Session,
  type SessionCreateOptions,
  type SessionForkOptions,
  type SessionMetadata,
  type SessionRepo,
  type SessionStorage,
  type SessionTreeEntry,
} from "@earendil-works/pi-agent-core";
import type { Session as StoredSession } from "../db/schema";
import type { SessionDao } from "../service/dao/session.dao.server";

export interface SqliteSessionMetadata extends SessionMetadata {
  databaseId: number;
  workspaceId: number;
  title: string;
}

export interface SqliteSessionCreateOptions extends SessionCreateOptions {
  title?: string;
}

export type SessionReference = Pick<SessionMetadata, "id">;

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function storageError(message: string, error: unknown): SessionError {
  return error instanceof SessionError
    ? error
    : new SessionError("storage", message, toError(error));
}

export function toSqliteSessionMetadata(session: StoredSession): SqliteSessionMetadata {
  return {
    id: session.agentSessionId,
    createdAt: session.createdAt.toISOString(),
    databaseId: session.id,
    workspaceId: session.workspaceId,
    title: session.title,
  };
}

function leafIdAfterEntry(entry: SessionTreeEntry): string | null {
  return entry.type === "leaf" ? entry.targetId : entry.id;
}

class SqliteSessionStorage implements SessionStorage<SqliteSessionMetadata> {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly metadata: SqliteSessionMetadata,
  ) {}

  async getMetadata(): Promise<SqliteSessionMetadata> {
    return this.metadata;
  }

  async getLeafId(): Promise<string | null> {
    const entries = await this.getEntries();
    let leafId: string | null = null;
    for (const entry of entries) {
      leafId = leafIdAfterEntry(entry);
    }
    if (leafId !== null && !entries.some((entry) => entry.id === leafId)) {
      throw new SessionError("invalid_session", `Entry ${leafId} not found`);
    }
    return leafId;
  }

  async setLeafId(leafId: string | null): Promise<void> {
    if (leafId !== null && !(await this.getEntry(leafId))) {
      throw new SessionError("not_found", `Entry ${leafId} not found`);
    }
    await this.appendEntry({
      type: "leaf",
      id: await this.createEntryId(),
      parentId: await this.getLeafId(),
      timestamp: new Date().toISOString(),
      targetId: leafId,
    });
  }

  async createEntryId(): Promise<string> {
    try {
      for (let attempt = 0; attempt < 100; attempt++) {
        const id = uuidv7().slice(-8);
        if (!this.sessionDao.findEntry(this.metadata.databaseId, id)) {
          return id;
        }
      }
      return uuidv7();
    } catch (error) {
      throw storageError("Failed to create session entry id", error);
    }
  }

  async appendEntry(entry: SessionTreeEntry): Promise<void> {
    try {
      this.sessionDao.appendEntry(this.metadata.databaseId, entry);
    } catch (error) {
      throw storageError(`Failed to append session entry ${entry.id}`, error);
    }
  }

  async getEntry(id: string): Promise<SessionTreeEntry | undefined> {
    try {
      return this.sessionDao.findEntry(this.metadata.databaseId, id)?.payload;
    } catch (error) {
      throw storageError(`Failed to read session entry ${id}`, error);
    }
  }

  async findEntries<TType extends SessionTreeEntry["type"]>(
    type: TType,
  ): Promise<Array<Extract<SessionTreeEntry, { type: TType }>>> {
    try {
      return this.sessionDao
        .findEntriesByType(this.metadata.databaseId, type)
        .map((entry) => entry.payload);
    } catch (error) {
      throw storageError(`Failed to read ${type} session entries`, error);
    }
  }

  async getLabel(id: string): Promise<string | undefined> {
    const labels = await this.findEntries("label");
    let label: string | undefined;
    for (const entry of labels) {
      if (entry.targetId !== id) {
        continue;
      }
      label = entry.label?.trim() || undefined;
    }
    return label;
  }

  async getPathToRoot(leafId: string | null): Promise<SessionTreeEntry[]> {
    if (leafId === null) {
      return [];
    }

    const entries = await this.getEntries();
    const byId = new Map(entries.map((entry) => [entry.id, entry]));
    const path: SessionTreeEntry[] = [];
    const visited = new Set<string>();
    let current = byId.get(leafId);
    if (!current) {
      throw new SessionError("not_found", `Entry ${leafId} not found`);
    }

    while (current) {
      if (visited.has(current.id)) {
        throw new SessionError("invalid_session", `Cycle detected at entry ${current.id}`);
      }
      visited.add(current.id);
      path.unshift(current);
      if (!current.parentId) {
        break;
      }
      const parentId: string = current.parentId;
      const parent = byId.get(parentId);
      if (!parent) {
        throw new SessionError("invalid_session", `Entry ${parentId} not found`);
      }
      current = parent;
    }
    return path;
  }

  async getEntries(): Promise<SessionTreeEntry[]> {
    try {
      return this.sessionDao.findEntries(this.metadata.databaseId).map((entry) => entry.payload);
    } catch (error) {
      throw storageError("Failed to read session entries", error);
    }
  }
}

export class SessionManager implements SessionRepo<
  SqliteSessionMetadata,
  SqliteSessionCreateOptions,
  void
> {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly workspaceId: number,
  ) {}

  async create(options: SqliteSessionCreateOptions): Promise<Session<SqliteSessionMetadata>> {
    try {
      const stored = this.sessionDao.create({
        workspaceId: this.workspaceId,
        title: options.title ?? "",
        agentSessionId: options.id ?? uuidv7(),
      });
      return this.toSession(stored);
    } catch (error) {
      throw storageError("Failed to create session", error);
    }
  }

  async open(metadata: SessionReference): Promise<Session<SqliteSessionMetadata>> {
    try {
      const stored = this.findStoredSession(metadata.id);
      return this.toSession(stored);
    } catch (error) {
      throw storageError(`Failed to open session ${metadata.id}`, error);
    }
  }

  async list(): Promise<SqliteSessionMetadata[]> {
    try {
      return this.sessionDao.findByWorkspaceId(this.workspaceId).map(toSqliteSessionMetadata);
    } catch (error) {
      throw storageError("Failed to list sessions", error);
    }
  }

  async delete(metadata: SessionReference): Promise<void> {
    try {
      const stored = this.sessionDao.findByAgentSessionIdAndWorkspaceId(
        metadata.id,
        this.workspaceId,
      );
      if (stored) {
        this.sessionDao.delete(stored.id);
      }
    } catch (error) {
      throw storageError(`Failed to delete session ${metadata.id}`, error);
    }
  }

  async fork(
    source: SessionReference,
    options: SessionForkOptions & SqliteSessionCreateOptions,
  ): Promise<Session<SqliteSessionMetadata>> {
    try {
      const sourceSession = await this.open(source);
      const entries = await getEntriesToFork(sourceSession.getStorage(), options);
      const stored = this.sessionDao.createWithEntries(
        {
          workspaceId: this.workspaceId,
          title: options.title ?? "",
          agentSessionId: options.id ?? uuidv7(),
        },
        entries,
      );
      return this.toSession(stored);
    } catch (error) {
      throw storageError(`Failed to fork session ${source.id}`, error);
    }
  }

  private findStoredSession(agentSessionId: string): StoredSession {
    const stored = this.sessionDao.findByAgentSessionIdAndWorkspaceId(
      agentSessionId,
      this.workspaceId,
    );
    if (!stored) {
      throw new SessionError("not_found", `Session not found: ${agentSessionId}`);
    }
    return stored;
  }

  private toSession(stored: StoredSession): Session<SqliteSessionMetadata> {
    return toSession(new SqliteSessionStorage(this.sessionDao, toSqliteSessionMetadata(stored)));
  }
}
