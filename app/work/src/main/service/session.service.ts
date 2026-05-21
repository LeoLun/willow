import { AgentService, type AgentContextCompressionState } from "@main/service/agent.service";
import { SessionMessageDao } from "@main/service/dao/session-message.dao.service";
import { SessionDao } from "@main/service/dao/session.dao.service";
import { EventService } from "@main/service/event.service";
import { SkillService } from "@main/service/skill.service";
import { TodoService } from "@main/service/todo.service";
import { WorkspaceAgentService } from "@main/service/workspace-agent.service";
import { WorkspaceService } from "@main/service/workspace.service";
import {
  clipForTitlePrompt,
  lastAssistantTextOnly,
  sanitizeSessionTitle,
} from "@main/utils/agent-message-text";
import { parseStoredSessionMessages } from "@main/utils/session-message-parse";
import type { AgentEvent, AgentMessage } from "@mariozechner/pi-agent-core";
import type { ActiveSessionStream, SendMessage, Session, ToolApproval } from "@shared/api";
import {
  CONTEXT_COMPRESSION_UPDATED,
  SESSION_LIST_UPDATED,
  SESSION_TITLE_UPDATED,
} from "@shared/constants";
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
    resolveToolApproval(
      toolCallId: string,
      decision: ToolApprovalDecision,
      reason?: string,
    ): boolean;
    contextCompression?: AgentContextCompressionState;
  };
  agent: {
    abort(): void;
  };
  stopRequested: boolean;
}

interface DelegatedSessionRun {
  childSessionId: number;
  abort(): void;
}

interface AgentExecutionOptions {
  session: Session;
  chatScope: "conversation" | "workspace";
  promptInput: string;
  modelId?: string;
  webSearchEnabled?: boolean;
  targetWorkspaceId?: number;
  forwardApprovalsToParentSessionId?: number;
}

@Injectable()
export class SessionService {
  private activeSessionStreams = new Map<number, ActiveSessionStreamState>();
  private runningSessions = new Map<number, RunningSession>();
  private delegatedSessionRuns = new Map<number, DelegatedSessionRun>();

  constructor(
    private readonly sessionDao: SessionDao,
    private readonly sessionMessageDao: SessionMessageDao,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
    private readonly skillService: SkillService,
    private readonly todoService: TodoService,
    private readonly workspaceAgentService: WorkspaceAgentService,
    private readonly workspaceService: WorkspaceService,
  ) {
    this.agentService.registerWorkspaceDelegateHandler((params) =>
      this.runWorkspaceDelegate(params),
    );
  }

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
    const session = await this.sessionDao.insert({
      workspaceId: workspaceId,
      title: "",
    });
    this.eventService.sendEvent(SESSION_LIST_UPDATED, { workspaceId });
    return session;
  }

  async getOrCreateConversationSession() {
    const workspace = await this.workspaceService.getOrCreateConversationWorkspace();
    const existing = this.sessionDao.findLatestByWorkspaceId(workspace.id);
    if (existing) {
      return { session: existing, workspace };
    }

    const session = await this.createSession(workspace.id);
    return { session, workspace };
  }

  async renameSession(sessionId: number, title: string) {
    return this.sessionDao.update(sessionId, { title });
  }

  async deleteSession(sessionId: number) {
    const session = this.sessionDao.findById(sessionId);
    this.stopSessionStream(sessionId);
    this.activeSessionStreams.delete(sessionId);
    this.todoService.clearSession(sessionId);
    this.sessionMessageDao.deleteBySessionId(sessionId);
    const result = this.sessionDao.deleteById(sessionId);
    if (session) {
      this.eventService.sendEvent(SESSION_LIST_UPDATED, { workspaceId: session.workspaceId });
    }
    return result;
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
    const delegatedRun = this.delegatedSessionRuns.get(sessionId);
    if (delegatedRun) {
      delegatedRun.abort();
    }

    const runningSession = this.runningSessions.get(sessionId);
    if (!runningSession || runningSession.stopRequested) {
      return;
    }

    runningSession.stopRequested = true;
    runningSession.agent.abort();
  }

  async createSessionTitle(sessionId: number, userInput: string): Promise<void> {
    try {
      const session = await this.sessionDao.findById(sessionId);
      if (!session || session.title.trim()) {
        return;
      }

      const userText = clipForTitlePrompt(userInput.trim());
      let title = "";

      if (userText) {
        try {
          const titleAgent = await this.agentService.getTitleAgent();
          await titleAgent.prompt(`请为下面这段首轮用户输入生成标题。\n\n用户输入：\n${userText}`);
          title = sanitizeSessionTitle(lastAssistantTextOnly(titleAgent.state.messages));
        } catch (e) {
          console.error(
            "createSessionTitle agent failed",
            sessionId,
            e instanceof Error ? e.message : e,
          );
        }
      }
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
    console.log("[SessionService] sendMessage sessionId=", sessionId);
    const session = await this.sessionDao.findById(sessionId);
    if (!session) {
      console.error("[SessionService] session not found:", sessionId);
      throw new Error("session not found");
    }
    const workspace = await this.workspaceService.getWorkspaceInfo(session.workspaceId);
    const chatScope = workspace?.kind === "conversation" ? "conversation" : "workspace";
    console.log("[SessionService] chatScope=", chatScope, "workspaceId=", session.workspaceId);

    const targetWorkspaceId = await this.resolveTargetWorkspaceId(
      session.workspaceId,
      chatScope,
      data.message,
      data.selectedWorkspaceAgent?.workspaceId,
    );

    this.sessionDao.update(sessionId, { lastActiveAt: new Date() });
    const promptInput = this.buildPromptInput(session.workspaceId, data.message);

    // No interceptor: delegating workspace agents will be handled by workspace_delegate tool call inside main agent stream.

    const priorMessageCount = this.sessionMessageDao.findBySessionId(sessionId).length;
    if (priorMessageCount === 0) {
      void this.createSessionTitle(sessionId, promptInput);
    }

    return this.executeAgentSession({
      session,
      chatScope,
      promptInput,
      modelId: data.modelId,
      webSearchEnabled: data.webSearchEnabled,
      targetWorkspaceId,
    });
  }

  private async executeAgentSession({
    session,
    chatScope,
    promptInput,
    modelId,
    webSearchEnabled,
    targetWorkspaceId,
    forwardApprovalsToParentSessionId,
  }: AgentExecutionOptions): Promise<string> {
    await this.sessionDao.update(session.id, { lastActiveAt: new Date() });
    this.eventService.sendEvent(SESSION_LIST_UPDATED, { workspaceId: session.workspaceId });

    const priorMessageCount = this.sessionMessageDao.findBySessionId(session.id).length;

    // Build workspace agents context for conversation scope
    let workspaceAgentsContext: string | undefined;
    if (chatScope === "conversation") {
      const { agents } = await this.workspaceAgentService.getWorkspaceAgents();
      const available = agents.filter((a) => a.available);
      if (available.length > 0) {
        workspaceAgentsContext = available
          .map(
            (a) => `- **${a.agentName}** (工作空间: ${a.workspaceName})\n  ${a.agentDescription}`,
          )
          .join("\n");
      }
    }

    const coreAgent = await this.agentService.getDefaultAgent(
      session,
      modelId,
      webSearchEnabled,
      promptInput,
      targetWorkspaceId,
      workspaceAgentsContext,
    );
    const agent = coreAgent.agent;
    if (coreAgent.contextCompression?.notification) {
      this.eventService.sendEvent(CONTEXT_COMPRESSION_UPDATED, {
        ...coreAgent.contextCompression.notification,
        chatScope,
      });
    }
    const offPendingApproval = coreAgent.approvalCoordinator.onPending((approval) => {
      this.upsertToolApproval(session.id, approval);
    });
    const offResolvedApproval = coreAgent.approvalCoordinator.onResolved((approval) => {
      this.upsertToolApproval(session.id, approval);
    });

    // Forward approvals to parent session for in-conversation approval
    let offParentPending: (() => void) | undefined;
    let offParentResolved: (() => void) | undefined;
    if (forwardApprovalsToParentSessionId) {
      const parentId = forwardApprovalsToParentSessionId;
      offParentPending = coreAgent.approvalCoordinator.onPending((approval) => {
        this.upsertToolApproval(parentId, approval);
      });
      offParentResolved = coreAgent.approvalCoordinator.onResolved((approval) => {
        this.upsertToolApproval(parentId, approval);
      });
    }

    this.runningSessions.set(session.id, {
      coreAgent,
      agent,
      stopRequested: false,
    });
    let replyText = "";

    const unsubscribe = agent.subscribe((event: AgentEvent) => {
      const displayMessages = this.buildDisplayMessages(coreAgent, agent.state.messages);
      this.updateActiveSessionStream(session.id, event, displayMessages);
      // agent_end 自带的 event.messages 仅为本轮新增（pi-agent-core newMessages），不含历史
      if (event.type === "agent_end") {
        this.persistAgentMessagesSnapshot(
          session.id,
          agent.state.messages,
          coreAgent.contextCompression,
        );
      }
      const outgoing: any =
        event.type === "agent_end" || event.type === "agent_start"
          ? { ...event, messages: displayMessages }
          : event;
      this.eventService.sendEvent("UPDATE_MESSAGE", {
        sessionId: session.id,
        groupId: "0",
        chatScope,
        event: outgoing,
      });
    });
    try {
      if (priorMessageCount === 0) {
        void this.createSessionTitle(session.id, promptInput);
      }
      await agent.prompt(promptInput);
      replyText = lastAssistantTextOnly(agent.state.messages);
      return replyText;
    } catch (error) {
      if (this.runningSessions.get(session.id)?.stopRequested) {
        return "";
      }
      throw error;
    } finally {
      this.activeSessionStreams.delete(session.id);
      this.runningSessions.delete(session.id);
      offPendingApproval();
      offResolvedApproval();
      offParentPending?.();
      offParentResolved?.();
      unsubscribe();
    }
  }

  private buildPromptInput(workspaceId: number, message: string) {
    const normalizedMessage = message.trim();

    return normalizedMessage;
  }

  private async resolveAgentNameForWorkspace(workspaceId: number): Promise<string> {
    const { agents } = await this.workspaceAgentService.getWorkspaceAgents();
    const matched = agents.find((a) => a.workspaceId === workspaceId && a.available);
    return matched?.agentName ?? "工作空间 Agent";
  }

  private async resolveTargetWorkspaceId(
    sessionWorkspaceId: number,
    chatScope: "conversation" | "workspace",
    message: string,
    selectedWorkspaceId?: number,
  ): Promise<number | undefined> {
    if (chatScope !== "conversation") {
      return undefined;
    }

    if (selectedWorkspaceId) {
      return selectedWorkspaceId;
    }

    const { agents } = await this.workspaceAgentService.getWorkspaceAgents();
    const availableAgents = agents.filter((agent) => agent.available);
    const normalizedMessage = message.trim().toLowerCase();

    const matched = availableAgents.find((agent) => {
      return (
        normalizedMessage.includes(agent.agentName.toLowerCase()) ||
        normalizedMessage.includes(agent.workspaceName.toLowerCase())
      );
    });

    if (matched) {
      return matched.workspaceId;
    }

    if (availableAgents.length === 1 && normalizedMessage.includes("工作空间")) {
      return availableAgents[0].workspaceId;
    }

    if (sessionWorkspaceId === selectedWorkspaceId) {
      return undefined;
    }

    return undefined;
  }

  async resolveToolApproval(
    sessionId: number,
    toolCallId: string,
    decision: ToolApprovalDecision,
    reason?: string,
  ): Promise<void> {
    let targetSessionId = sessionId;
    while (true) {
      const delegatedRun = this.delegatedSessionRuns.get(targetSessionId);
      if (delegatedRun) {
        targetSessionId = delegatedRun.childSessionId;
      } else {
        break;
      }
    }

    const runningSession = this.runningSessions.get(targetSessionId);
    if (!runningSession) {
      throw new Error("session is not running");
    }

    const resolved = runningSession.coreAgent.resolveToolApproval(toolCallId, decision, reason);
    if (!resolved) {
      throw new Error("tool approval not found");
    }
  }

  /**
   * 尚无「会话分组」产品时 group_id 统一占位为 0。
   * 未压缩时用 agent.state.messages 全量覆盖写入（勿用 agent_end.event.messages，其不含历史）。
   * 已压缩时保留较早原始消息行，只替换主 Agent 实际持有的最近窗口和新消息。
   */
  private persistAgentMessagesSnapshot(
    sessionId: number,
    messages: AgentMessage[],
    compression?: AgentContextCompressionState,
  ): void {
    const GROUP_PLACEHOLDER = 0;
    try {
      if (compression && compression.replaceMessageIds.length > 0) {
        this.sessionMessageDao.deleteByIds(compression.replaceMessageIds);
      } else {
        this.sessionMessageDao.deleteBySessionId(sessionId);
      }
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

  private buildDisplayMessages(
    coreAgent: RunningSession["coreAgent"],
    messages: AgentMessage[],
  ): AgentMessage[] {
    const prefix = coreAgent.contextCompression?.displayMessagePrefix;
    if (!prefix || prefix.length === 0) {
      return messages;
    }
    return [...prefix, ...messages];
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

  private async updateParentSessionToolCallArgs(
    parentSessionId: number,
    toolCallId: string,
    argsPatch: Record<string, any>,
  ) {
    const streamState = this.activeSessionStreams.get(parentSessionId);
    if (!streamState) return;

    let updated = false;

    for (const msg of streamState.messages) {
      if (msg.role === "assistant" && Array.isArray(msg.content)) {
        for (const element of msg.content) {
          if (element.type === "toolCall" && element.id === toolCallId) {
            element.arguments = {
              ...(element.arguments as any),
              ...argsPatch,
            };
            updated = true;
          }
        }
      }
    }

    const streamMsg = streamState.streamMessage;
    if (streamMsg?.role === "assistant" && Array.isArray(streamMsg.content)) {
      for (const element of streamMsg.content) {
        if (element.type === "toolCall" && element.id === toolCallId) {
          element.arguments = {
            ...(element.arguments as any),
            ...argsPatch,
          };
          updated = true;
        }
      }
    }

    if (updated) {
      const parentSession = this.sessionDao.findById(parentSessionId);
      const parentWorkspace = parentSession
        ? await this.workspaceService.getWorkspaceInfo(parentSession.workspaceId)
        : null;
      const parentChatScope =
        parentWorkspace?.kind === "conversation" ? "conversation" : "workspace";

      this.persistAgentMessagesSnapshot(parentSessionId, streamState.messages);

      const displayMessage = streamMsg || streamState.messages[streamState.messages.length - 1];
      this.eventService.sendEvent("UPDATE_MESSAGE", {
        sessionId: parentSessionId,
        groupId: "0",
        chatScope: parentChatScope,
        event: {
          type: "message_update",
          message: displayMessage,
          messages: streamState.messages,
        },
      });
    }
  }

  async runWorkspaceDelegate(params: {
    workspaceId: number;
    task: string;
    sessionId?: number;
    toolCallId: string;
    parentSessionId: number;
  }) {
    const { workspaceId, task, sessionId, toolCallId, parentSessionId } = params;

    const targetWorkspace = await this.workspaceService.getWorkspaceInfo(workspaceId);
    if (!targetWorkspace || targetWorkspace.kind !== "project") {
      throw new Error("目标工作空间不存在或不是项目类型");
    }

    const agentName = await this.resolveAgentNameForWorkspace(workspaceId);

    let childSession: Session | undefined;
    if (sessionId) {
      const existing = this.sessionDao.findById(sessionId);
      if (existing && existing.workspaceId === workspaceId) {
        childSession = existing;
      }
    }

    if (!childSession) {
      childSession = await this.createSession(workspaceId);
    }

    void this.createSessionTitle(childSession.id, task);

    this.delegatedSessionRuns.set(parentSessionId, {
      childSessionId: childSession.id,
      abort: () => this.stopSessionStream(childSession.id),
    });

    await this.updateParentSessionToolCallArgs(parentSessionId, toolCallId, {
      childSessionId: childSession.id,
    });

    let childResult = "";
    let stopped = false;
    let failed = false;

    try {
      childResult = await this.executeAgentSession({
        session: childSession,
        chatScope: "workspace",
        promptInput: task,
        forwardApprovalsToParentSessionId: parentSessionId,
      });
      stopped = childResult.trim().length === 0;
    } catch (error) {
      childResult = error instanceof Error ? error.message : "工作空间子 Agent 执行失败";
      failed = true;
    } finally {
      this.delegatedSessionRuns.delete(parentSessionId);
    }

    if (this.runningSessions.get(childSession.id)?.stopRequested) {
      stopped = true;
    }

    const status = (stopped ? "stopped" : failed ? "failed" : "completed") as
      | "completed"
      | "failed"
      | "stopped";
    const summaryText = stopped ? "已停止本次工作空间子 Agent 执行。" : childResult;

    return {
      content: [
        {
          type: "text" as const,
          text: `委派执行已${stopped ? "停止" : failed ? "失败" : "完成"}。子会话 ID: ${childSession.id}。\n${stopped ? "" : `执行结果如下：\n${summaryText}`}`,
        },
      ],
      details: {
        childSessionId: childSession.id,
        workspaceId,
        workspaceName: targetWorkspace.name,
        agentName,
        status,
        summary: summaryText,
      },
    };
  }
}
