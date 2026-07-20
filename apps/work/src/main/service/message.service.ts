import type { AgentHarness, AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { MessageEventPayload, MessageStreamEvent, ModelConfig } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";
import { TitleService } from "./title.service";

export type SendMessageInput = {
  workspaceId: number;
  sessionId: string;
  content: string;
  model: ModelConfig;
};

type ActiveTask = {
  harness: AgentHarness;
  unsubscribe: () => void;
  stopped: boolean;
};

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
    const harness = await this.agentService.getAgentHarness({
      workspaceId: input.workspaceId,
      cwd: workspace.path,
      model,
      metadata: session,
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

  getMessageList(workspaceId: number, sessionId: string): Promise<AgentMessage[]> {
    return this.sessionService.getMessageList(workspaceId, sessionId);
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

  private taskKey(workspaceId: number, sessionId: string): string {
    return `${workspaceId}:${sessionId}`;
  }
}
