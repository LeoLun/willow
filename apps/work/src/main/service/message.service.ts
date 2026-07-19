import type { AgentHarness, AgentMessage } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { MessageEventPayload, MessageStreamEvent, ModelConfig } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { WorkspaceDao } from "./dao/workspace.dao.server";
import { EventService } from "./event.service";
import { SessionService } from "./session.service";
import { UserConfigService } from "./user-config.service";

export type SendMessageInput = {
  workspaceId: number;
  sessionId: string;
  content: string;
  model: ModelConfig;
};

export type CreateTitleInput = Omit<SendMessageInput, "model">;

type ActiveTask = {
  harness: AgentHarness;
  unsubscribe: () => void;
  stopped: boolean;
};

const TITLE_MAX_LENGTH = 50;
const TITLE_SYSTEM_PROMPT =
  "Generate a concise title for the user's message. Return only the title without quotes or Markdown.";

/**
 * 用于管理 Message 的服务
 */
@Injectable()
export class MessageService {
  private readonly activeTasks = new Map<string, ActiveTask>();
  private readonly busySessions = new Set<string>();
  private readonly pendingTitles = new Map<string, Promise<void>>();

  constructor(
    private readonly sessionService: SessionService,
    private readonly agentService: AgentService,
    private readonly eventService: EventService,
    private readonly workspaceDao: WorkspaceDao,
    private readonly userConfigService: UserConfigService,
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
    this.emit({ type: "status", sessionId: input.sessionId, status: "running" });

    if (session.title.trim() === "") {
      this.startTitleCreation({
        workspaceId: input.workspaceId,
        sessionId: input.sessionId,
        content,
      });
    }

    try {
      const response = await harness.prompt(content);
      if (!task.stopped) {
        this.emit({ type: "status", sessionId: input.sessionId, status: "completed" });
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

  async createTitle(input: CreateTitleInput): Promise<string> {
    const content = this.validateContent(input.content);
    const workspace = this.workspaceDao.findById(input.workspaceId);
    if (!workspace) {
      throw new Error(`Workspace not found: ${input.workspaceId}`);
    }

    const session = this.sessionService.getSession(input.workspaceId, input.sessionId);
    if (session.title.trim() !== "") return session.title;

    const fallbackTitle = this.normalizeTitle(content);
    let title = fallbackTitle;
    const smallModelConfig = this.userConfigService.getConfig().smallModel;

    if (smallModelConfig) {
      let harness: AgentHarness | undefined;
      try {
        const model = this.agentService.getModel(
          smallModelConfig.providerId,
          smallModelConfig.modelId,
        );
        harness = await this.agentService.getSimpleAgent({
          cwd: workspace.path,
          model,
          systemPrompt: TITLE_SYSTEM_PROMPT,
        });
        const response = await harness.prompt(content);
        const generated = response.content
          .filter((block) => block.type === "text")
          .map((block) => block.text)
          .join(" ");
        title = this.normalizeTitle(generated) || fallbackTitle;
      } catch {
        title = fallbackTitle;
      } finally {
        await harness?.env.cleanup();
      }
    }

    const current = this.sessionService.getSession(input.workspaceId, input.sessionId);
    if (current.title.trim() !== "") return current.title;

    await this.sessionService.updateSessionTitle(input.workspaceId, input.sessionId, title);
    this.emit({ type: "title_updated", sessionId: input.sessionId, title });
    return title;
  }

  private startTitleCreation(input: CreateTitleInput): void {
    const key = this.taskKey(input.workspaceId, input.sessionId);
    if (this.pendingTitles.has(key)) return;

    const pending = this.createTitle(input)
      .then(() => undefined)
      .catch(() => undefined)
      .finally(() => {
        if (this.pendingTitles.get(key) === pending) {
          this.pendingTitles.delete(key);
        }
      });
    this.pendingTitles.set(key, pending);
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

  private normalizeTitle(value: string): string {
    const normalized = value
      .replace(/[`*_#]+/g, "")
      .replace(/^(["'“‘])|(["'”’])$/g, "")
      .replace(/\s+/g, " ")
      .trim();
    return [...normalized].slice(0, TITLE_MAX_LENGTH).join("");
  }

  private taskKey(workspaceId: number, sessionId: string): string {
    return `${workspaceId}:${sessionId}`;
  }
}
