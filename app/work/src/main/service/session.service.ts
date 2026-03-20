import { Injectable } from "@willow/poetry";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";

@Injectable()
export class SessionService {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
  ) {}

  async getSessionList(workspaceId: string) {
    return this.sessionDao.findByWorkspaceId(Number(workspaceId));
  }

  async createSession(workspaceId: string) {
    return this.sessionDao.insert({
      workspaceId: Number(workspaceId),
      title: "新会话",
    });
  }

  async deleteSession(sessionId: string) {
    const id = Number(sessionId);
    this.sessionMessageDao.deleteBySessionId(id);
    return this.sessionDao.deleteById(id);
  }

  async getSessionHistory(sessionId: string) {
    return this.sessionMessageDao.findBySessionId(Number(sessionId));
  }

  sendSession(sessionId: string, data: any): void {
    // 发送 session（流式对话，暂不涉及 DAO）
  }

  private createAgentSession(sessionId: string) {
    return new Agent({
      sessionId: sessionId,
      initialState: {
        model: getModel("anthropic", "claude-sonnet-4-20250514"),
      },
    });
  }
}
