import { Injectable } from "@willow/poetry";
import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import type { SendMessage } from "@shared/api";
import { AgentService } from "@main/service/agent.service";
import { EventService } from "@main/service/event.service";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
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

  /** 供渲染进程与会话恢复：有序 Agent 消息列表 */
  getSessionHistoryAgentMessages(sessionId: number): AgentMessage[] {
    const rows = this.sessionMessageDao.findBySessionId(sessionId);
    return parseStoredSessionMessages(rows);
  }

  async createSessionTitle(sessionId: number) {
    const session = await this.sessionDao.findById(sessionId);
    if (session && !session.title) {
      // @TODO 将用户提问通过 AI 转化为 title
    }
  }

  async sendMessage(sessionId: number, data: SendMessage): Promise<string> {
    const session = await this.sessionDao.findById(sessionId);
    if (!session) {
      throw new Error("session not found");
    }

    const agent = await this.agentService.getDefaultAgent(session);
    let replyText = "";

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      // agent_end 自带的 event.messages 仅为本轮新增（pi-agent-core newMessages），不含历史
      if (event.type === "agent_end") {
        this.persistAgentMessagesSnapshot(sessionId, agent.state.messages);
      }
      const outgoing: AgentEvent =
        event.type === "agent_end"
          ? { ...event, messages: agent.state.messages }
          : event;
      this.eventService.sendEvent("UPDATE_MESSAGE", {
        sessionId: sessionId,
        groupId: "0",
        event: outgoing,
      });
    });
    try {
      await agent.prompt(data.message);
      return replyText;
    } finally {
      unsubscribe();
    }
  }

  /**
   * 尚无「会话分组」产品时 group_id 统一占位为 0。
   * 用 agent.state.messages 全量覆盖写入（勿用 agent_end.event.messages，其不含历史）。
   */
  private persistAgentMessagesSnapshot(
    sessionId: number,
    messages: AgentMessage[],
  ): void {
    const GROUP_PLACEHOLDER = 0;
    try {
      this.sessionMessageDao.deleteBySessionId(sessionId);
      if (messages.length === 0) {
        return;
      }
      this.sessionMessageDao.insertMany(
        messages.map((m) => ({
          sessionId,
          groupId: GROUP_PLACEHOLDER,
          role: m.role,
          content: JSON.stringify(m),
        })),
      );
    } catch (e) {
      console.error("persist session messages failed", sessionId, e);
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
