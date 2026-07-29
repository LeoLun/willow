import type { AgentHarness, AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  GetMessageListResponse,
  MessageEventPayload,
  MessageStreamEvent,
  ModelConfig,
  PermissionMode,
  ResolveToolApprovalRequest,
} from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import type { ToolApprovalHandler } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { AiToolApprovalService } from "./ai-tool-approval.service";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";
import { TitleService } from "./title.service";
import { ToolApprovalService } from "./tool-approval.service";

export type SendMessageInput = {
  workspaceId: number;
  sessionId: string;
  content: string;
  model: ModelConfig;
  approvalMode?: PermissionMode;
};

type ActiveTask = {
  harness: AgentHarness;
  unsubscribe: () => void;
  stopped: boolean;
};

type ToolResultMessage = Extract<AgentMessage, { role: "toolResult" }>;

/**
 * 用于管理 Message 的服务
 */
@Injectable()
export class MessageService {
  private readonly activeTasks = new Map<string, ActiveTask>();
  private readonly busySessions = new Set<string>();
  constructor(
    private readonly sessionService: SessionService,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly titleService: TitleService,
    private readonly aiToolApprovalService: AiToolApprovalService,
    private readonly toolApprovalService: ToolApprovalService,
  ) {}

  async sendMessage(input: SendMessageInput): Promise<AssistantMessage> {
    const content = this.validateContent(input.content);
    const key = this.taskKey(input.workspaceId, input.sessionId);
    if (this.busySessions.has(key)) {
      throw new Error(`Session is already running: ${input.sessionId}`);
    }
    this.busySessions.add(key);

    try {
      return await this.executeMessage(input, content, key);
    } finally {
      this.busySessions.delete(key);
    }
  }

  private async executeMessage(
    input: SendMessageInput,
    content: string,
    key: string,
  ): Promise<AssistantMessage> {
    const workspace = this.workspaceDao.findById(input.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${input.workspaceId}`);
    }

    const session = this.sessionService.getSession(input.workspaceId, input.sessionId);
    const model = this.agentService.getModel(input.model.providerId, input.model.modelId);
    const permissionMode = input.approvalMode ?? "request-approval";
    const harness = await this.agentService.getAgentHarness({
      workspaceId: input.workspaceId,
      cwd: workspace.path,
      model,
      metadata: session,
      permissionMode,
      requestApproval: this.createApprovalHandler({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        workspacePath: workspace.path,
        userMessage: content,
        model: input.model,
        permissionMode,
      }),
    });
    const unsubscribe = harness.subscribe((event) => {
      if (this.isMessageStreamEvent(event)) {
        this.emit({ type: "stream", sessionId: input.sessionId, event });
      }
    });
    const task: ActiveTask = { harness, unsubscribe, stopped: false };
    this.activeTasks.set(key, task);
    this.emit({
      type: "status",
      sessionId: input.sessionId,
      status: "started",
    });

    if (session.title.trim() === "") {
      this.titleService.startTitleCreation({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        content,
      });
    }

    try {
      const response = await harness.prompt(content);
      if (!task.stopped) {
        this.emit({
          type: "status",
          sessionId: input.sessionId,
          status: "completed",
        });
      }
      return response;
    } catch (error) {
      if (!task.stopped) {
        this.emit({
          type: "status",
          sessionId: input.sessionId,
          status: "failed",
          error: "Message generation failed",
        });
      }
      throw error;
    } finally {
      unsubscribe();
      if (this.activeTasks.get(key) === task) {
        this.activeTasks.delete(key);
      }
    }
  }

  async stopMessage(workspaceId: number, sessionId: string): Promise<boolean> {
    const task = this.activeTasks.get(this.taskKey(workspaceId, sessionId));
    if (!task || task.stopped) return false;

    task.stopped = true;
    await task.harness.abort();
    this.emit({ type: "status", sessionId, status: "stopped" });
    return true;
  }

  async getMessageList(workspaceId: number, sessionId: string): Promise<GetMessageListResponse> {
    const [messages, approval] = await Promise.all([
      this.sessionService.getMessageList(workspaceId, sessionId),
      this.toolApprovalService.getPendingApproval(workspaceId, sessionId),
    ]);
    return { messages, pendingToolApproval: approval?.payload };
  }

  async resolveToolApproval(request: ResolveToolApprovalRequest): Promise<boolean> {
    const key = this.taskKey(request.workspaceId, request.sessionId);
    if (this.busySessions.has(key)) {
      const resolution = await this.toolApprovalService.resolve(
        request.workspaceId,
        request.sessionId,
        request.approvalId,
        request.decision,
      );
      return resolution?.live ?? false;
    }

    this.busySessions.add(key);
    let continuingInBackground = false;
    try {
      const resolution = await this.toolApprovalService.resolve(
        request.workspaceId,
        request.sessionId,
        request.approvalId,
        request.decision,
        "recovered",
      );
      if (!resolution) return false;
      if (!resolution.live) {
        void this.resumeToolApproval(resolution.approval, request.decision, key)
          .catch((error) => {
            console.error("Failed to resume persisted tool approval:", error);
          })
          .finally(() => {
            this.busySessions.delete(key);
          });
        continuingInBackground = true;
        return true;
      }
      return true;
    } finally {
      if (!continuingInBackground) this.busySessions.delete(key);
    }
  }

  private emit(payload: MessageEventPayload): void {
    this.eventService.sendEvent(MESSAGE_EVENT, payload);
  }

  private isMessageStreamEvent(event: { type: string }): event is MessageStreamEvent {
    return (
      event.type === "message_start" ||
      event.type === "message_update" ||
      event.type === "message_end"
    );
  }

  private validateContent(content: string): string {
    if (typeof content !== "string" || content.trim() === "") {
      throw new Error("Message content must be a non-empty string");
    }
    return content.trim();
  }

  private createApprovalHandler(options: {
    workspaceId: number;
    sessionId: string;
    workspacePath: string;
    userMessage: string;
    model: ModelConfig;
    permissionMode: PermissionMode;
  }): ToolApprovalHandler {
    return async (request, signal) => {
      if (signal?.aborted) return "deny";
      if (options.permissionMode === "full-access") return "allow";
      if (options.permissionMode !== "delegate-approval") {
        return await this.toolApprovalService.request(
          options.workspaceId,
          options.sessionId,
          request,
          {
            model: options.model,
            permissionMode: options.permissionMode,
            userMessage: options.userMessage,
          },
          signal,
        );
      }

      const review = await this.aiToolApprovalService.review(
        {
          workspaceId: options.workspaceId,
          sessionId: options.sessionId,
          workspacePath: options.workspacePath,
          userMessage: options.userMessage,
          request,
        },
        signal,
      );
      if (signal?.aborted) return "deny";
      if (review.status === "approved") return "allow";
      return await this.toolApprovalService.request(
        options.workspaceId,
        options.sessionId,
        request,
        {
          model: options.model,
          permissionMode: options.permissionMode,
          userMessage: options.userMessage,
        },
        signal,
        { status: review.status, reason: review.reason },
      );
    };
  }

  private taskKey(workspaceId: number, sessionId: string): string {
    return `${workspaceId}:${sessionId}`;
  }

  private async resumeToolApproval(
    approval: import("./tool-approval.service").PersistedToolApproval,
    decision: import("@shared/api").ToolApprovalDecision,
    key: string,
  ): Promise<void> {
    const { payload } = approval;
    const workspace = this.workspaceDao.findById(payload.workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${payload.workspaceId}`);

    const session = this.sessionService.getSession(payload.workspaceId, payload.sessionId);
    const model = this.agentService.getModel(approval.model.providerId, approval.model.modelId);
    const fallbackApproval = this.createApprovalHandler({
      workspaceId: payload.workspaceId,
      sessionId: payload.sessionId,
      workspacePath: workspace.path,
      userMessage: approval.userMessage,
      model: approval.model,
      permissionMode: approval.permissionMode,
    });
    let replayApprovalAvailable = true;
    const harness = await this.agentService.getAgentHarness({
      workspaceId: payload.workspaceId,
      cwd: workspace.path,
      model,
      metadata: session,
      permissionMode: approval.permissionMode,
      requestApproval: async (request, signal) => {
        if (
          replayApprovalAvailable &&
          request.toolCallId === payload.toolCallId &&
          request.toolName === payload.toolName
        ) {
          replayApprovalAvailable = false;
          return decision;
        }
        return fallbackApproval(request, signal);
      },
    });
    const unsubscribe = harness.subscribe((event) => {
      if (this.isMessageStreamEvent(event)) {
        this.emit({ type: "stream", sessionId: payload.sessionId, event });
      }
    });
    const task: ActiveTask = { harness, unsubscribe, stopped: false };
    this.activeTasks.set(key, task);
    this.emit({ type: "status", sessionId: payload.sessionId, status: "started" });

    try {
      const toolResult = await this.replayToolCall(harness, approval, decision);
      await harness.appendMessage(toolResult);
      this.emit({
        type: "stream",
        sessionId: payload.sessionId,
        event: { type: "message_start", message: toolResult },
      });
      this.emit({
        type: "stream",
        sessionId: payload.sessionId,
        event: { type: "message_end", message: toolResult },
      });
      await harness.continue();
      if (!task.stopped) {
        this.emit({ type: "status", sessionId: payload.sessionId, status: "completed" });
      }
    } catch (error) {
      if (!task.stopped) {
        this.emit({
          type: "status",
          sessionId: payload.sessionId,
          status: "failed",
          error: "Message generation failed",
        });
      }
      throw error;
    } finally {
      unsubscribe();
      if (this.activeTasks.get(key) === task) this.activeTasks.delete(key);
    }
  }

  private async replayToolCall(
    harness: AgentHarness,
    approval: import("./tool-approval.service").PersistedToolApproval,
    decision: import("@shared/api").ToolApprovalDecision,
  ): Promise<ToolResultMessage> {
    const { payload } = approval;
    if (decision === "deny") {
      return this.createToolResult(payload, "用户拒绝了此工具调用。", true);
    }

    const tool = harness.getTools().find((candidate) => candidate.name === payload.toolName);
    if (!tool) {
      return this.createToolResult(payload, `无法恢复工具：${payload.toolName}`, true);
    }
    try {
      const result = await tool.execute(payload.toolCallId, payload.input as never);
      return {
        role: "toolResult",
        toolCallId: payload.toolCallId,
        toolName: payload.toolName,
        content: result.content ?? [],
        details: result.details,
        isError: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createToolResult(
        payload,
        error instanceof Error ? error.message : String(error),
        true,
      );
    }
  }

  private createToolResult(
    payload: import("@shared/api").ToolApprovalEventPayload,
    message: string,
    isError: boolean,
  ): ToolResultMessage {
    return {
      role: "toolResult",
      toolCallId: payload.toolCallId,
      toolName: payload.toolName,
      content: [{ type: "text", text: message }],
      details: {},
      isError,
      timestamp: Date.now(),
    };
  }
}
