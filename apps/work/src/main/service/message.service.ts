import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import type {
  AgentHarness,
  AgentHarnessEvent,
  AgentMessage,
  SessionTreeEntry,
} from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type {
  AgentMode,
  GetMessageListResponse,
  MessageEventPayload,
  ModelConfig,
  PermissionMode,
  LocalFileAttachment,
  ResolveToolApprovalRequest,
  ResolveUserQuestionRequest,
} from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import {
  appendLocalFileBlock,
  isImageAttachment,
  isLocalFileGrant,
  LOCAL_FILE_GRANT_CUSTOM_TYPE,
  parseLocalFilePrompt,
  type LocalFileGrant,
} from "@shared/local-file";
import type { AskUserAnswers, AskUserHandler, ToolApprovalHandler } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { AiToolApprovalService } from "./ai-tool-approval.service";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";
import { LocalFileService } from "./local-file.service";
import { MessageStreamEmitter } from "./message-stream-emitter";
import { SessionService } from "./session.service";
import { TitleService } from "./title.service";
import { ToolApprovalService } from "./tool-approval.service";
import { TurnArtifactCapture, TurnArtifactService } from "./turn-artifact.service";
import { UserQuestionService } from "./user-question.service";

export type SendMessageInput = {
  workspaceId: number;
  sessionId: string;
  content: string;
  model: ModelConfig;
  agentMode?: AgentMode;
  approvalMode?: PermissionMode;
  attachments?: LocalFileAttachment[];
  /**
   * 仅限主进程内部使用的输入，renderer 的 IPC 无法设置。
   * unattended 模式下工具审批固定走 AI 审批，失败不回退到人工审批，
   * 且 ask-user 会直接报错而不是创建待回答问题。
   */
  interactionMode?: "interactive" | "unattended";
};

/** 无人值守交互错误：无法由用户参与的审批或提问在无人值守模式下的收口错误。 */
export class UnattendedInteractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnattendedInteractionError";
  }
}

type ActiveTask = {
  harness: AgentHarness;
  stream: MessageStreamEmitter;
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
    private readonly localFileService: LocalFileService,
    private readonly titleService: TitleService,
    private readonly aiToolApprovalService: AiToolApprovalService,
    private readonly toolApprovalService: ToolApprovalService,
    private readonly userQuestionService: UserQuestionService,
    private readonly turnArtifactService: TurnArtifactService,
  ) {}

  async sendMessage(input: SendMessageInput): Promise<AssistantMessage> {
    const content = this.validateContent(input.content, input.attachments?.length ?? 0);
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
    const branch = await this.sessionService.getBranch(input.workspaceId, input.sessionId);
    const inheritedFiles = this.getGrantedFiles(branch);
    const inspectedAttachments =
      input.attachments && input.attachments.length > 0
        ? await this.localFileService.inspect(input.attachments.map((file) => file.path))
        : [];
    const attachedImages = inspectedAttachments.filter(isImageAttachment);
    const images = await this.localFileService.loadImages(attachedImages);
    const grant =
      inspectedAttachments.length > 0
        ? ({ requestId: randomUUID(), files: inspectedAttachments } satisfies LocalFileGrant)
        : undefined;
    if (grant) {
      await this.sessionService.appendCustomEntry(
        input.workspaceId,
        input.sessionId,
        LOCAL_FILE_GRANT_CUSTOM_TYPE,
        grant,
      );
    }
    const grantedFiles = this.mergeFiles(inheritedFiles, inspectedAttachments);
    const permissionMode = input.approvalMode ?? "request-approval";
    const agentMode = input.agentMode ?? "default";
    const interactionMode = input.interactionMode ?? "interactive";
    const harness = await this.agentService.getAgentHarness({
      workspaceId: input.workspaceId,
      cwd: workspace.path,
      model,
      metadata: session,
      agentMode,
      sandboxPolicy: this.sandboxPolicyForFiles(grantedFiles, agentMode),
      permissionMode,
      requestApproval: this.createApprovalHandler({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        workspacePath: workspace.path,
        userMessage: content,
        model: input.model,
        permissionMode,
        agentMode,
        interactionMode,
      }),
      requestUser: this.createUserQuestionHandler({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        model: input.model,
        permissionMode,
        agentMode,
        userMessage: content,
        interactionMode,
      }),
    });
    const artifactCapture = await this.turnArtifactService.begin(
      input.workspaceId,
      input.sessionId,
      branch,
    );
    const stream = new MessageStreamEmitter(input.sessionId, (payload) => this.emit(payload));
    const unsubscribe = harness.subscribe((event) => {
      if (event.type === "message_end") artifactCapture.recordMessage(event.message);
      if (this.isMessageStreamEvent(event)) {
        stream.push(event);
      }
    });
    const task: ActiveTask = { harness, stream, unsubscribe, stopped: false };
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
        content: content || inspectedAttachments.map((file) => file.name).join(", "),
      });
    }

    try {
      const prompt = grant ? appendLocalFileBlock(content, grant) : content;
      const response =
        images.length > 0 ? await harness.prompt(prompt, { images }) : await harness.prompt(prompt);
      await this.completeArtifactCapture(input.sessionId, artifactCapture, response.timestamp);
      if (!task.stopped) {
        if (response.stopReason === "error") {
          this.emit({
            type: "status",
            sessionId: input.sessionId,
            status: "failed",
            error: response.errorMessage?.trim() || "模型服务请求失败，请重试。",
          });
        } else if (response.stopReason === "aborted") {
          this.emit({
            type: "status",
            sessionId: input.sessionId,
            status: "stopped",
          });
        } else {
          this.emit({
            type: "status",
            sessionId: input.sessionId,
            status: "completed",
          });
        }
      }
      return response;
    } catch (error) {
      await artifactCapture.dispose();
      if (!task.stopped) {
        this.emit({
          type: "status",
          sessionId: input.sessionId,
          status: "failed",
          error:
            error instanceof Error && error.message ? error.message : "Message generation failed",
        });
      }
      throw error;
    } finally {
      await artifactCapture.dispose();
      stream.dispose();
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
    task.stream.flush();
    this.emit({ type: "status", sessionId, status: "stopped" });
    return true;
  }

  async getMessageList(workspaceId: number, sessionId: string): Promise<GetMessageListResponse> {
    const [messages, branch, approval, question] = await Promise.all([
      this.sessionService.getMessageList(workspaceId, sessionId),
      this.sessionService.getBranch(workspaceId, sessionId),
      this.toolApprovalService.getPendingApproval(workspaceId, sessionId),
      this.userQuestionService.getPendingQuestion(workspaceId, sessionId),
    ]);
    return {
      messages,
      artifacts: this.turnArtifactService.getArtifacts(branch),
      pendingToolApproval: approval?.payload,
      pendingUserQuestion: question?.payload,
    };
  }

  async resolveUserQuestion(request: ResolveUserQuestionRequest): Promise<boolean> {
    const key = this.taskKey(request.workspaceId, request.sessionId);
    if (this.busySessions.has(key)) {
      const resolution = await this.userQuestionService.resolve(
        request.workspaceId,
        request.sessionId,
        request.requestId,
        request.answers,
      );
      return resolution?.live ?? false;
    }

    this.busySessions.add(key);
    let continuingInBackground = false;
    try {
      const resolution = await this.userQuestionService.resolve(
        request.workspaceId,
        request.sessionId,
        request.requestId,
        request.answers,
        "recovered",
      );
      if (!resolution) return false;
      if (!resolution.live) {
        void this.resumeUserQuestion(resolution.question, request.answers, key)
          .catch((error) => {
            console.error("Failed to resume persisted user question:", error);
          })
          .finally(() => {
            this.busySessions.delete(key);
          });
        continuingInBackground = true;
      }
      return true;
    } finally {
      if (!continuingInBackground) this.busySessions.delete(key);
    }
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

  private async completeArtifactCapture(
    sessionId: string,
    capture: TurnArtifactCapture,
    assistantTimestamp?: number,
  ): Promise<void> {
    try {
      const artifact = await capture.complete(assistantTimestamp);
      if (artifact) this.emit({ type: "artifact", sessionId, artifact });
    } catch (error) {
      console.error("保存轮次产物失败:", error);
    }
  }

  private isMessageStreamEvent(
    event: AgentHarnessEvent,
  ): event is Extract<
    AgentHarnessEvent,
    { type: "message_start" | "message_update" | "message_end" }
  > {
    return (
      event.type === "message_start" ||
      event.type === "message_update" ||
      event.type === "message_end"
    );
  }

  private validateContent(content: string, attachmentCount: number): string {
    if (typeof content !== "string" || (content.trim() === "" && attachmentCount === 0)) {
      throw new Error("Message must include text or an attachment");
    }
    return content.trim();
  }

  private getGrantedFiles(branch: readonly SessionTreeEntry[]): LocalFileAttachment[] {
    const referencedRequestIds = new Set<string>();
    for (const entry of branch) {
      if (entry.type !== "message" || entry.message.role !== "user") continue;
      for (const content of this.getTextContents(entry.message.content)) {
        const parsed = parseLocalFilePrompt(content);
        if (parsed.grant) referencedRequestIds.add(parsed.grant.requestId);
      }
    }

    const files: LocalFileAttachment[] = [];
    for (const entry of branch) {
      if (
        entry.type !== "custom" ||
        entry.customType !== LOCAL_FILE_GRANT_CUSTOM_TYPE ||
        !isLocalFileGrant(entry.data) ||
        !referencedRequestIds.has(entry.data.requestId)
      ) {
        continue;
      }
      files.push(...entry.data.files.filter((file) => isAbsolute(file.path)));
    }
    return this.mergeFiles(files);
  }

  private getTextContents(content: unknown): string[] {
    if (typeof content === "string") return [content];
    if (!Array.isArray(content)) return [];
    return content.flatMap((block) => {
      if (
        typeof block === "object" &&
        block !== null &&
        "type" in block &&
        block.type === "text" &&
        "text" in block &&
        typeof block.text === "string"
      ) {
        return [block.text];
      }
      return [];
    });
  }

  private mergeFiles(...groups: readonly LocalFileAttachment[][]): LocalFileAttachment[] {
    const files = new Map<string, LocalFileAttachment>();
    for (const group of groups) {
      for (const file of group) files.set(file.path, file);
    }
    return [...files.values()];
  }

  private sandboxPolicyForFiles(files: readonly LocalFileAttachment[], agentMode: AgentMode) {
    const paths = files.map((file) => file.path);
    return agentMode === "plan" ? { allowRead: paths } : { allowWrite: paths };
  }

  private createApprovalHandler(options: {
    workspaceId: number;
    sessionId: string;
    workspacePath: string;
    userMessage: string;
    model: ModelConfig;
    permissionMode: PermissionMode;
    agentMode: AgentMode;
    interactionMode: "interactive" | "unattended";
  }): ToolApprovalHandler {
    return async (request, signal) => {
      if (signal?.aborted) return "deny";
      if (options.permissionMode === "full-access") return "allow";
      if (options.interactionMode === "unattended") {
        if (options.permissionMode !== "delegate-approval") {
          throw new UnattendedInteractionError("无人值守模式下无法请求人工审批。");
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
        throw new UnattendedInteractionError(review.reason);
      }
      if (options.permissionMode !== "delegate-approval") {
        return await this.toolApprovalService.request(
          options.workspaceId,
          options.sessionId,
          request,
          {
            model: options.model,
            permissionMode: options.permissionMode,
            agentMode: options.agentMode,
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
          agentMode: options.agentMode,
          userMessage: options.userMessage,
        },
        signal,
        { status: review.status, reason: review.reason },
      );
    };
  }

  private createUserQuestionHandler(options: {
    workspaceId: number;
    sessionId: string;
    model: ModelConfig;
    permissionMode: PermissionMode;
    agentMode: AgentMode;
    userMessage: string;
    interactionMode: "interactive" | "unattended";
  }): AskUserHandler {
    if (options.interactionMode === "unattended") {
      return async () => {
        throw new UnattendedInteractionError("无人值守模式下无法向用户提问。");
      };
    }
    return (request, signal) =>
      this.userQuestionService.request(
        options.workspaceId,
        options.sessionId,
        request,
        {
          model: options.model,
          permissionMode: options.permissionMode,
          agentMode: options.agentMode,
          userMessage: options.userMessage,
        },
        signal,
      );
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
    const branch = await this.sessionService.getBranch(payload.workspaceId, payload.sessionId);
    const model = this.agentService.getModel(approval.model.providerId, approval.model.modelId);
    const fallbackApproval = this.createApprovalHandler({
      workspaceId: payload.workspaceId,
      sessionId: payload.sessionId,
      workspacePath: workspace.path,
      userMessage: approval.userMessage,
      model: approval.model,
      permissionMode: approval.permissionMode,
      agentMode: approval.agentMode ?? "default",
      interactionMode: "interactive",
    });
    let replayApprovalAvailable = true;
    const harness = await this.agentService.getAgentHarness({
      workspaceId: payload.workspaceId,
      cwd: workspace.path,
      model,
      metadata: session,
      agentMode: approval.agentMode ?? "default",
      sandboxPolicy: this.sandboxPolicyForFiles(
        this.getGrantedFiles(branch),
        approval.agentMode ?? "default",
      ),
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
      requestUser: this.createUserQuestionHandler({
        workspaceId: payload.workspaceId,
        sessionId: payload.sessionId,
        model: approval.model,
        permissionMode: approval.permissionMode,
        agentMode: approval.agentMode ?? "default",
        userMessage: approval.userMessage,
        interactionMode: "interactive",
      }),
    });
    const artifactCapture = await this.turnArtifactService.begin(
      payload.workspaceId,
      payload.sessionId,
      branch,
    );
    const stream = new MessageStreamEmitter(payload.sessionId, (eventPayload) =>
      this.emit(eventPayload),
    );
    const unsubscribe = harness.subscribe((event) => {
      if (event.type === "message_end") artifactCapture.recordMessage(event.message);
      if (this.isMessageStreamEvent(event)) {
        stream.push(event);
      }
    });
    const task: ActiveTask = { harness, stream, unsubscribe, stopped: false };
    this.activeTasks.set(key, task);
    this.emit({ type: "status", sessionId: payload.sessionId, status: "started" });

    try {
      const toolResult = await this.replayToolCall(harness, approval, decision);
      artifactCapture.recordMessage(toolResult);
      await harness.appendMessage(toolResult);
      stream.push({ type: "message_start", message: toolResult });
      stream.push({ type: "message_end", message: toolResult });
      await harness.continue();
      await this.completeArtifactCapture(payload.sessionId, artifactCapture);
      if (!task.stopped) {
        this.emit({ type: "status", sessionId: payload.sessionId, status: "completed" });
      }
    } catch (error) {
      await artifactCapture.dispose();
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
      await artifactCapture.dispose();
      stream.dispose();
      unsubscribe();
      if (this.activeTasks.get(key) === task) this.activeTasks.delete(key);
    }
  }

  private async resumeUserQuestion(
    question: import("./user-question.service").PersistedUserQuestion,
    answers: AskUserAnswers | undefined,
    key: string,
  ): Promise<void> {
    const { payload } = question;
    const workspace = this.workspaceDao.findById(payload.workspaceId);
    if (!workspace) throw new Error(`Workspace not found: ${payload.workspaceId}`);

    const session = this.sessionService.getSession(payload.workspaceId, payload.sessionId);
    const branch = await this.sessionService.getBranch(payload.workspaceId, payload.sessionId);
    const model = this.agentService.getModel(question.model.providerId, question.model.modelId);
    const fallbackApproval = this.createApprovalHandler({
      workspaceId: payload.workspaceId,
      sessionId: payload.sessionId,
      workspacePath: workspace.path,
      userMessage: question.userMessage,
      model: question.model,
      permissionMode: question.permissionMode,
      agentMode: question.agentMode ?? "default",
      interactionMode: "interactive",
    });
    const fallbackQuestion = this.createUserQuestionHandler({
      workspaceId: payload.workspaceId,
      sessionId: payload.sessionId,
      model: question.model,
      permissionMode: question.permissionMode,
      agentMode: question.agentMode ?? "default",
      userMessage: question.userMessage,
      interactionMode: "interactive",
    });
    let replayQuestionAvailable = true;
    const harness = await this.agentService.getAgentHarness({
      workspaceId: payload.workspaceId,
      cwd: workspace.path,
      model,
      metadata: session,
      agentMode: question.agentMode ?? "default",
      sandboxPolicy: this.sandboxPolicyForFiles(
        this.getGrantedFiles(branch),
        question.agentMode ?? "default",
      ),
      permissionMode: question.permissionMode,
      requestApproval: fallbackApproval,
      requestUser: async (request, signal) => {
        if (replayQuestionAvailable && request.toolCallId === payload.toolCallId) {
          replayQuestionAvailable = false;
          return answers;
        }
        return fallbackQuestion(request, signal);
      },
    });
    const artifactCapture = await this.turnArtifactService.begin(
      payload.workspaceId,
      payload.sessionId,
      branch,
    );
    const stream = new MessageStreamEmitter(payload.sessionId, (eventPayload) =>
      this.emit(eventPayload),
    );
    const unsubscribe = harness.subscribe((event) => {
      if (event.type === "message_end") artifactCapture.recordMessage(event.message);
      if (this.isMessageStreamEvent(event)) {
        stream.push(event);
      }
    });
    const task: ActiveTask = { harness, stream, unsubscribe, stopped: false };
    this.activeTasks.set(key, task);
    this.emit({ type: "status", sessionId: payload.sessionId, status: "started" });

    try {
      const toolResult = await this.replayUserQuestion(harness, question);
      artifactCapture.recordMessage(toolResult);
      await harness.appendMessage(toolResult);
      stream.push({ type: "message_start", message: toolResult });
      stream.push({ type: "message_end", message: toolResult });
      await harness.continue();
      await this.completeArtifactCapture(payload.sessionId, artifactCapture);
      if (!task.stopped) {
        this.emit({ type: "status", sessionId: payload.sessionId, status: "completed" });
      }
    } catch (error) {
      await artifactCapture.dispose();
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
      await artifactCapture.dispose();
      stream.dispose();
      unsubscribe();
      if (this.activeTasks.get(key) === task) this.activeTasks.delete(key);
    }
  }

  private async replayUserQuestion(
    harness: AgentHarness,
    question: import("./user-question.service").PersistedUserQuestion,
  ): Promise<ToolResultMessage> {
    const { payload } = question;
    const tool = harness.getTools().find((candidate) => candidate.name === "askUser");
    if (!tool) {
      return this.createToolResult(
        { toolCallId: payload.toolCallId, toolName: "askUser" },
        "无法恢复工具：askUser",
        true,
      );
    }
    try {
      const result = await tool.execute(payload.toolCallId, { questions: payload.questions });
      return {
        role: "toolResult",
        toolCallId: payload.toolCallId,
        toolName: "askUser",
        content: result.content ?? [],
        details: result.details,
        isError: false,
        timestamp: Date.now(),
      };
    } catch (error) {
      return this.createToolResult(
        { toolCallId: payload.toolCallId, toolName: "askUser" },
        error instanceof Error ? error.message : String(error),
        true,
      );
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
    payload: { toolCallId: string; toolName: string },
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
