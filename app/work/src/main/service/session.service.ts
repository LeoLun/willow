import { AgentService } from "@main/service/agent.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { EventService } from "@main/service/event.service";
import { SkillService } from "@main/service/skill.service";
import { TodoService } from "@main/service/todo.service";
import {
  clipForTitlePrompt,
  extractPlainTextFromAgentMessage,
  isUserLikeMessage,
  lastAssistantPlainText,
  sanitizeSessionTitle,
} from "@main/utils/agent-message-text";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { ActiveSessionStream, SendMessage, ToolApproval } from "@shared/api";
import { SESSION_TITLE_UPDATED } from "@shared/constants";
import type { ToolApprovalDecision } from "@willow/core";
import { Injectable } from "@willow/poetry";

interface ActiveSessionStreamState {
  messages: AgentMessage[];
  streamMessage: AgentMessage | null;
  isStreaming: boolean;
  pendingToolCallIds: Set<string>;
  toolApprovals: Map<string, ToolApproval>;
}

interface RunningSession {
  coreAgent: {
    agent: {
      abort(): void;
      subscribe(fn: (event: AgentEvent) => void): () => void;
      prompt(input: string): Promise<void>;
      state: {
        messages: AgentMessage[];
      };
    };
    approvalCoordinator: {
      onPending(listener: (approval: ToolApproval) => void): () => void;
      onResolved(listener: (approval: ToolApproval) => void): () => void;
    };
    resolveToolApproval(toolCallId: string, decision: ToolApprovalDecision): boolean;
  };
  agent: {
    abort(): void;
  };
  stopRequested: boolean;
}

@Injectable()
export class SessionService {
  private activeSessionStreams = new Map<number, ActiveSessionStreamState>();
  private runningSessions = new Map<number, RunningSession>();

  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
    private readonly skillService: SkillService,
    private readonly todoService: TodoService,
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
    this.stopSessionStream(sessionId);
    this.activeSessionStreams.delete(sessionId);
    this.todoService.clearSession(sessionId);
    this.sessionMessageDao.deleteBySessionId(sessionId);
    return this.sessionDao.deleteById(sessionId);
  }

  async getSessionHistory(sessionId: number) {
    return this.sessionMessageDao.findBySessionId(sessionId);
  }

  /** 供渲染进程与会话恢复：有序 Agent 消息列表 */
  getSessionHistoryAgentMessages(sessionId: number): AgentMessage[] {
    const activeStream = this.activeSessionStreams.get(sessionId);
    if (activeStream) {
      return activeStream.messages;
    }
    const rows = this.sessionMessageDao.findBySessionId(sessionId);
    return parseStoredSessionMessages(rows);
  }

  getActiveSessionStream(sessionId: number): ActiveSessionStream | undefined {
    const stream = this.activeSessionStreams.get(sessionId);
    if (!stream) {
      return undefined;
    }

    const todos = this.todoService.getTodos(sessionId);

    return {
      messages: stream.messages,
      streamMessage: stream.streamMessage,
      isStreaming: stream.isStreaming,
      pendingToolCallIds: Array.from(stream.pendingToolCallIds),
      toolApprovals:
        stream.toolApprovals.size > 0 ? Array.from(stream.toolApprovals.values()) : undefined,
      todos: todos.length > 0 ? todos : undefined,
    };
  }

  stopSessionStream(sessionId: number): void {
    const runningSession = this.runningSessions.get(sessionId);
    if (!runningSession || runningSession.stopRequested) {
      return;
    }

    runningSession.stopRequested = true;
    runningSession.agent.abort();
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

    const coreAgent = await this.agentService.getDefaultAgent(
      session,
      data.modelId,
      data.webSearchEnabled,
    );
    const agent = coreAgent.agent;
    const offPendingApproval = coreAgent.approvalCoordinator.onPending((approval) => {
      this.upsertToolApproval(sessionId, approval);
    });
    const offResolvedApproval = coreAgent.approvalCoordinator.onResolved((approval) => {
      this.upsertToolApproval(sessionId, approval);
    });
    this.runningSessions.set(sessionId, {
      coreAgent,
      agent,
      stopRequested: false,
    });
    let replyText = "";

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      this.updateActiveSessionStream(sessionId, event, agent.state.messages);
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
      await agent.prompt(this.buildPromptInput(session.workspaceId, data.message));
      return replyText;
    } catch (error) {
      if (this.runningSessions.get(sessionId)?.stopRequested) {
        return "";
      }
      throw error;
    } finally {
      this.activeSessionStreams.delete(sessionId);
      this.runningSessions.delete(sessionId);
      offPendingApproval();
      offResolvedApproval();
      unsubscribe();
    }
  }

  private buildPromptInput(workspaceId: number, message: string) {
    console.log("workspaceId", workspaceId);
    console.log("message", message);

    const normalizedMessage = message.trim();

    return normalizedMessage;
  }

  async resolveToolApproval(
    sessionId: number,
    toolCallId: string,
    decision: ToolApprovalDecision,
  ): Promise<void> {
    const runningSession = this.runningSessions.get(sessionId);
    if (!runningSession) {
      throw new Error("session is not running");
    }

    const resolved = runningSession.coreAgent.resolveToolApproval(toolCallId, decision);
    if (!resolved) {
      throw new Error("tool approval not found");
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

  private updateActiveSessionStream(
    sessionId: number,
    event: AgentEvent,
    messages: AgentMessage[],
  ): void {
    const current = this.activeSessionStreams.get(sessionId) ?? {
      messages: [],
      streamMessage: null,
      isStreaming: false,
      pendingToolCallIds: new Set<string>(),
      toolApprovals: new Map<string, ToolApproval>(),
    };

    current.messages = [...messages];

    switch (event.type) {
      case "agent_start":
        current.isStreaming = true;
        current.streamMessage = null;
        current.pendingToolCallIds.clear();
        current.toolApprovals.clear();
        break;

      case "message_start":
      case "message_update":
        current.isStreaming = true;
        current.streamMessage = event.message ?? null;
        break;

      case "message_end":
        current.streamMessage = null;
        break;

      case "tool_execution_start":
      case "tool_execution_update":
        if (event.toolCallId) {
          current.pendingToolCallIds.add(event.toolCallId);
        }
        break;

      case "tool_execution_end":
        if (event.toolCallId) {
          current.pendingToolCallIds.delete(event.toolCallId);
        }
        break;

      case "agent_end":
        current.isStreaming = false;
        current.streamMessage = null;
        current.pendingToolCallIds.clear();
        break;

      case "turn_start":
      case "turn_end":
        break;
    }

    this.activeSessionStreams.set(sessionId, current);
  }

  private upsertToolApproval(sessionId: number, approval: ToolApproval): void {
    const current = this.activeSessionStreams.get(sessionId) ?? {
      messages: [],
      streamMessage: null,
      isStreaming: false,
      pendingToolCallIds: new Set<string>(),
      toolApprovals: new Map<string, ToolApproval>(),
    };

    current.toolApprovals.set(approval.toolCallId, approval);
    this.activeSessionStreams.set(sessionId, current);
    this.eventService.sendEvent("UPDATE_MESSAGE", {
      sessionId,
      groupId: "0",
      event: {
        type: "tool_approval_update",
        approval,
      },
    });
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
