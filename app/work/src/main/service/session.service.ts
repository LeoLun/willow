import { Injectable } from "@willow/poetry";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import type { SendMessage } from "@shared/api";
import { AgentService } from "@main/service/agent.service";
@Injectable()
export class SessionService {
  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly agentService: AgentService,
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
    console.log("sendMessage", sessionId, data);
    const session = await this.sessionDao.findById(sessionId);
    // 发送 session（流式对话，暂不涉及 DAO）
    const agent = await this.agentService.getDefaultAgent(session);
    console.log("agent 11111");
    let replyText = "";

    const onChunk = (chunk: string) => {
      console.log("onChunk", chunk);
    };
    console.log("onChunk 22222");
    const unsubscribe = agent.subscribe((event) => {
      if (
        event.type === "message_update" &&
        event.assistantMessageEvent.type === "text_delta"
      ) {
        const delta = event.assistantMessageEvent.delta;
        replyText += delta;
        onChunk(delta);
      }
    });
    console.log("unsubscribe 33333");
    try {
      await agent.prompt(data.message);
      console.log("replyText", replyText);
      return replyText;
    } catch (error) {
      console.log("error", error);
    } finally {
      console.log("finally 44444");
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
