import { SessionError, type SessionForkOptions } from "@earendil-works/pi-agent-core";
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
