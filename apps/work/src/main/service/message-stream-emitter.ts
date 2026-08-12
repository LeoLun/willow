import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { MessageEventPayload, MessageStreamPatch } from "@shared/api";

export const MESSAGE_STREAM_FLUSH_INTERVAL_MS = 50;

type SourceEvent = Extract<
  AgentEvent,
  { type: "message_start" | "message_update" | "message_end" }
>;

type Emit = (payload: MessageEventPayload) => void;

function toPatch(
  event: Extract<SourceEvent, { type: "message_update" }>,
): MessageStreamPatch | undefined {
  if (event.message.role !== "assistant") return undefined;
  const update = event.assistantMessageEvent;
  if (update.type === "start" || update.type === "done" || update.type === "error") {
    return undefined;
  }

  if (update.type === "text_delta" || update.type === "thinking_delta") {
    return { type: update.type, contentIndex: update.contentIndex, delta: update.delta };
  }

  const content = event.message.content[update.contentIndex];
  if (!content) return undefined;
  return { type: update.type, contentIndex: update.contentIndex, content };
}

export class MessageStreamEmitter {
  private patches: MessageStreamPatch[] = [];
  private messageTimestamp?: number;
  private flushTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly sessionId: string,
    private readonly emit: Emit,
  ) {}

  private enqueuePatch(patch: MessageStreamPatch): void {
    if (patch.type === "text_delta" || patch.type === "thinking_delta") {
      const previous = this.patches.at(-1);
      if (previous?.type === patch.type && previous.contentIndex === patch.contentIndex) {
        previous.delta += patch.delta;
        return;
      }
      this.patches.push(patch);
      return;
    }

    this.patches = this.patches.filter(
      (candidate) => candidate.contentIndex !== patch.contentIndex,
    );
    this.patches.push(patch);
  }

  push(event: SourceEvent): void {
    if (event.type === "message_start") {
      this.flush();
      this.emit({
        type: "stream",
        sessionId: this.sessionId,
        event: { type: "start", message: event.message },
      });
      return;
    }

    if (event.type === "message_end") {
      this.flush();
      this.emit({
        type: "stream",
        sessionId: this.sessionId,
        event: { type: "end", message: event.message },
      });
      return;
    }

    const patch = toPatch(event);
    if (!patch) return;
    this.messageTimestamp = (event.message as AssistantMessage).timestamp;
    this.enqueuePatch(patch);
    this.flushTimer ??= setTimeout(() => this.flush(), MESSAGE_STREAM_FLUSH_INTERVAL_MS);
  }

  flush(): void {
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = undefined;
    if (this.patches.length === 0 || this.messageTimestamp === undefined) return;

    const patches = this.patches;
    const messageTimestamp = this.messageTimestamp;
    this.patches = [];
    this.messageTimestamp = undefined;
    this.emit({
      type: "stream",
      sessionId: this.sessionId,
      event: { type: "update", messageTimestamp, patches },
    });
  }

  dispose(): void {
    this.flush();
  }
}
