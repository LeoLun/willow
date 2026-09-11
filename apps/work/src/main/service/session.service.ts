import {
  SessionError,
  type AgentMessage,
  type SessionForkOptions,
  type SessionTreeEntry,
} from "@earendil-works/pi-agent-core";
import { Injectable } from "@willow/poetry";
import {
  toSqliteSessionMetadata,
  type SqliteSessionCreateOptions,
  type SqliteSessionMetadata,
} from "../utils/session-manager";
import { SessionDao } from "./dao/session.dao.server";
import { SessionManagerFactory } from "./session-manager.factory";

export type ForkSessionOptions = SessionForkOptions & SqliteSessionCreateOptions;

/**
 * 用于管理 Session 的服务
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionManagerFactory: SessionManagerFactory,
  ) {}

  getSessionList(workspaceId: number): Promise<SqliteSessionMetadata[]> {
    return this.sessionManagerFactory.create(workspaceId).list();
  }

  getSession(workspaceId: number, agentSessionId: string): SqliteSessionMetadata {
    const stored = this.sessionDao.findByAgentSessionIdAndWorkspaceId(agentSessionId, workspaceId);
    if (!stored) {
      throw new SessionError("not_found", `Session not found: ${agentSessionId}`);
    }
    return toSqliteSessionMetadata(stored);
  }

  async getMessageList(
    workspaceId: number,
    agentSessionId: string,
  ): Promise<Array<AgentMessage & { completedAt?: number }>> {
    const branch = await this.getBranch(workspaceId, agentSessionId);
    return branch.flatMap<AgentMessage & { completedAt?: number }>((entry) => {
      if (entry.type !== "message") return [];
      if (entry.message.role === "user") return [entry.message];
      // The harness appends message entries at message_end. The message's own
      // timestamp is its creation time and must remain unchanged for identity.
      const completedAt = Date.parse(entry.timestamp);
      return [{ ...entry.message, ...(Number.isFinite(completedAt) ? { completedAt } : {}) }];
    });
  }

  async getBranch(workspaceId: number, agentSessionId: string): Promise<SessionTreeEntry[]> {
    const metadata = this.getSession(workspaceId, agentSessionId);
    const session = await this.sessionManagerFactory.create(workspaceId).open(metadata);
    return session.getBranch();
  }

  async appendCustomEntry(
    workspaceId: number,
    agentSessionId: string,
    customType: string,
    data: unknown,
  ): Promise<string> {
    const metadata = this.getSession(workspaceId, agentSessionId);
    const session = await this.sessionManagerFactory.create(workspaceId).open(metadata);
    return session.appendCustomEntry(customType, data);
  }

  async createSession(
    workspaceId: number,
    options: SqliteSessionCreateOptions = {},
  ): Promise<SqliteSessionMetadata> {
    const session = await this.sessionManagerFactory.create(workspaceId).create(options);
    return session.getMetadata();
  }

  deleteSession(workspaceId: number, agentSessionId: string): Promise<void> {
    return this.sessionManagerFactory.create(workspaceId).delete({ id: agentSessionId });
  }

  async forkSession(
    workspaceId: number,
    sourceAgentSessionId: string,
    options: ForkSessionOptions,
  ): Promise<SqliteSessionMetadata> {
    const session = await this.sessionManagerFactory
      .create(workspaceId)
      .fork({ id: sourceAgentSessionId }, options);
    return session.getMetadata();
  }

  async updateSessionTitle(
    workspaceId: number,
    agentSessionId: string,
    title: string,
  ): Promise<SqliteSessionMetadata> {
    const stored = this.sessionDao.findByAgentSessionIdAndWorkspaceId(agentSessionId, workspaceId);
    if (!stored) {
      throw new SessionError("not_found", `Session not found: ${agentSessionId}`);
    }

    const updated = this.sessionDao.update(stored.id, { title });
    if (!updated) {
      throw new SessionError("not_found", `Session not found: ${agentSessionId}`);
    }
    return toSqliteSessionMetadata(updated);
  }
}
