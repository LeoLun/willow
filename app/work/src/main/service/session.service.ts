import { Injectable } from "@willow/poetry";
import { Agent } from "@mariozechner/pi-agent-core";
import { getModel } from "@mariozechner/pi-ai";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import type { SendMessage } from "@shared/api";
@Injectable()
export class SessionService {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
  ) {}

  async getSessionList(workspaceId: number) {
    return this.sessionDao.findByWorkspaceId(workspaceId);
  }

  async getSessionListByWorkspaceIds(workspaceIds: number[]) {
    return this.sessionDao.findByWorkspaceIds(workspaceIds);
  }

  async createSession(workspaceId: number) {
    return this.sessionDao.insert({
      workspaceId: workspaceId,
      title: "未命名会话",
    });
  }

  async deleteSession(sessionId: number) {
    this.sessionMessageDao.deleteBySessionId(sessionId);
    return this.sessionDao.deleteById(sessionId);
  }

  async getSessionHistory(sessionId: number) {
    return this.sessionMessageDao.findBySessionId(sessionId);
  }

  async sendMessage(sessionId: number, data: SendMessage): Promise<void> {
    console.log("sendMessage", sessionId, data);
    // 发送 session（流式对话，暂不涉及 DAO）
  }

  private createAgentSession(sessionId: number) {
    // return new Agent({
    //   sessionId: sessionId,
    //   initialState: {
    //     model: getModel("anthropic", "claude-sonnet-4-20250514"),
    //   },
    // });
  }
}
