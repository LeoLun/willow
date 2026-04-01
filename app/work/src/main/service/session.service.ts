import { AgentService } from "@main/service/agent.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { EventService } from "@main/service/event.service";
import {
  clipForTitlePrompt,
  extractPlainTextFromAgentMessage,
  isUserLikeMessage,
  lastAssistantPlainText,
  sanitizeSessionTitle,
} from "@main/utils/agent-message-text";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { SendMessage } from "@shared/api";
import { SESSION_TITLE_UPDATED } from "@shared/constants";
import { Injectable } from "@willow/poetry";
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

  async getSessionListByWorkspaceIds(workspaceIds: number[], limit?: number) {
    if (limit) {
      const results: ReturnType<SessionDao["findByWorkspaceIdWithLimit"]> = [];
      for (const id of workspaceIds) {
        results.push(...this.sessionDao.findByWorkspaceIdWithLimit(id, limit));
      }
      return results;
    }
    return this.sessionDao.findByWorkspaceIds(workspaceIds);
  }

  async getSessionCountByWorkspaceIds(workspaceIds: number[]) {
    const totals: { [workspaceId: number]: number } = {};
    for (const id of workspaceIds) {
      const result = this.sessionDao.countByWorkspaceId(id);
      totals[id] = result?.count ?? 0;
    }
    return totals;
  }

  async getWorkspaceSessionsPaginated(workspaceId: number, page: number, pageSize: number) {
    const offset = (page - 1) * pageSize;
    const items = this.sessionDao.findByWorkspaceIdPaginated(workspaceId, pageSize, offset);
    const result = this.sessionDao.countByWorkspaceId(workspaceId);
    const total = result?.count ?? 0;
    return { sessions: items, total, page, pageSize };
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

  async createSessionTitle(sessionId: number): Promise<void> {
    try {
      const session = await this.sessionDao.findById(sessionId);
      if (!session || session.title.trim()) {
        return;
      }

      const messages = this.getSessionHistoryAgentMessages(sessionId);
      const userMsg = messages.find((m) => isUserLikeMessage(m));
      const assistantMsg = messages.find((m) => m.role === "assistant");
      if (!userMsg || !assistantMsg) {
        return;
      }

      const userText = clipForTitlePrompt(extractPlainTextFromAgentMessage(userMsg));
      const assistantText = clipForTitlePrompt(extractPlainTextFromAgentMessage(assistantMsg));
      if (!userText && !assistantText) {
        return;
      }

      const titleAgent = await this.agentService.getTitleAgent();
      await titleAgent.prompt(
        `请为下面这段首轮对话生成标题。\n\n用户：\n${userText || "（无文本）"}\n\n助手：\n${assistantText || "（无文本）"}`,
      );

      let title = sanitizeSessionTitle(lastAssistantPlainText(titleAgent.state.messages));
      if (!title) {
        title = sanitizeSessionTitle(userText.slice(0, 40)) || "新会话";
      }

      const again = await this.sessionDao.findById(sessionId);
      if (!again || again.title.trim()) {
        return;
      }

      const updated = await this.sessionDao.update(sessionId, { title });
      if (updated) {
        this.eventService.sendEvent(SESSION_TITLE_UPDATED, {
          session: updated,
        });
      }
    } catch (e) {
      console.error("createSessionTitle failed", sessionId, e instanceof Error ? e.message : e);
    }
  }

  async sendMessage(sessionId: number, data: SendMessage): Promise<string> {
    const session = await this.sessionDao.findById(sessionId);
    if (!session) {
      throw new Error("session not found");
    }

    this.sessionDao.update(sessionId, { lastActiveAt: new Date() });

    const priorMessageCount = this.sessionMessageDao.findBySessionId(sessionId).length;

    const agent = await this.agentService.getDefaultAgent(
      session,
      data.modelId,
      data.webSearchEnabled,
    );
    let replyText = "";

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      // agent_end 自带的 event.messages 仅为本轮新增（pi-agent-core newMessages），不含历史
      if (event.type === "agent_end") {
        this.persistAgentMessagesSnapshot(sessionId, agent.state.messages);
        if (priorMessageCount === 0) {
          void this.createSessionTitle(sessionId);
        }
      }
      const outgoing: AgentEvent =
        event.type === "agent_end" ? { ...event, messages: agent.state.messages } : event;
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
  private persistAgentMessagesSnapshot(sessionId: number, messages: AgentMessage[]): void {
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

  // private createAgentSession(sessionId: number) {
  // return new Agent({
  //   sessionId: sessionId,
  //   initialState: {
  //     model: getModel("anthropic", "claude-sonnet-4-20250514"),
  //   },
  // });
  // }
}
