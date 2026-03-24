import { Injectable } from "@willow/poetry";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import type { SendMessage } from "@shared/api";
import { AgentService } from "@main/service/agent.service";
import { EventService } from "@main/service/event.service";
@Injectable()
export class SessionService {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
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
      title: "",
    });
  }

  async renameSession(sessionId: number, title: string) {
    return this.sessionDao.update(sessionId, { title });
  }

  async deleteSession(sessionId: number) {
    this.sessionMessageDao.deleteBySessionId(sessionId);
    return this.sessionDao.deleteById(sessionId);
  }

  async getSessionHistory(sessionId: number) {
    return this.sessionMessageDao.findBySessionId(sessionId);
  }

  async createSessionTitle(sessionId: number) {
    const session = await this.sessionDao.findById(sessionId);
    if (session && !session.title) {
      // @TODO 将用户提问通过 AI 转化为 title
    }
  }

  async sendMessage(sessionId: number, data: SendMessage): Promise<string> {
    const session = await this.sessionDao.findById(sessionId);
    // 发送 session（流式对话，暂不涉及 DAO）
    const agent = await this.agentService.getDefaultAgent(session);
    let replyText = "";

    const unsubscribe = agent.subscribe((event) => {
      this.eventService.sendEvent("UPDATE_MESSAGE", {
        sessionId: sessionId,
        groupId: "123",
        event: event,
      });
    });
    try {
      await agent.prompt(data.message);
      return replyText;
    } finally {
      unsubscribe();
    }
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
