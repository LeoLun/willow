import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { MessageStreamEvent } from "@shared/api";
import type {
  Message,
  MessageContent,
  MessageRole,
  MessageTimeline,
  ThinkingStatus,
} from "./types";

type AgentMessageLike = {
  role?: unknown;
  content?: unknown;
  timestamp?: unknown;
  toolCallId?: unknown;
  toolName?: unknown;
  details?: unknown;
  isError?: unknown;
};

type ContentLike = Record<string, unknown> & { type?: unknown };

function asObject(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : undefined;
}

function toMessageRole(role: unknown): MessageRole {
  if (role === "user" || role === "assistant" || role === "toolResult") return role;
  return "assistant";
}

function toTimestamp(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function toUnknownContent(value: unknown, fallbackType = "unknown"): MessageContent {
  const object = asObject(value);
  return {
    type: "unknown",
    nodeType: typeof object?.type === "string" ? object.type : fallbackType,
    value,
  };
}

function toContent(value: unknown, thinkingStatus: ThinkingStatus = "completed"): MessageContent {
  const content = asObject(value) as ContentLike | undefined;
  if (!content || typeof content.type !== "string") return toUnknownContent(value);

  if (content.type === "text" && typeof content.text === "string") {
    return {
      type: "text",
      text: content.text,
      textSignature: typeof content.textSignature === "string" ? content.textSignature : undefined,
    };
  }

  if (
    content.type === "image" &&
    typeof content.data === "string" &&
    typeof content.mimeType === "string"
  ) {
    return { type: "image", data: content.data, mimeType: content.mimeType };
  }

  if (content.type === "thinking" && typeof content.thinking === "string") {
    return {
      type: "thinking",
      thinking: content.thinking,
      thinkingSignature:
        typeof content.thinkingSignature === "string" ? content.thinkingSignature : undefined,
      redacted: content.redacted === true,
      status: thinkingStatus,
    };
  }

  if (
    content.type === "toolCall" &&
    typeof content.id === "string" &&
    typeof content.name === "string"
  ) {
    return {
      type: "toolCall",
      id: content.id,
      name: content.name,
      arguments: content.arguments,
      thoughtSignature:
        typeof content.thoughtSignature === "string" ? content.thoughtSignature : undefined,
    };
  }

  return toUnknownContent(value, content.type);
}

function toContentList(
  message: AgentMessageLike,
  role: MessageRole,
  thinkingStatuses?: ReadonlyMap<number, ThinkingStatus>,
): MessageContent[] {
  if (role === "user" && typeof message.content === "string") {
    return [{ type: "text", text: message.content }];
  }
  if (!Array.isArray(message.content)) {
    return [toUnknownContent(message.content, "content")];
  }
  return message.content.map((content, index) => toContent(content, thinkingStatuses?.get(index)));
}

export function getMessageSourceKey(message: AgentMessage | unknown): string {
  const value = (asObject(message) ?? {}) as AgentMessageLike;
  const role = toMessageRole(value.role);
  const timestamp = toTimestamp(value.timestamp);
  const toolCallId = typeof value.toolCallId === "string" ? value.toolCallId : "";
  return [role, timestamp, toolCallId].join(":");
}

export function toMessage(
  agentMessage: AgentMessage | unknown,
  status: Message["status"] = "completed",
  id?: string,
  thinkingStatuses?: ReadonlyMap<number, ThinkingStatus>,
): Message {
  const value = (asObject(agentMessage) ?? {}) as AgentMessageLike;
  const role = toMessageRole(value.role);
  const timestamp = toTimestamp(value.timestamp);
  const sourceKey = getMessageSourceKey(agentMessage);

  return {
    id: id ?? sourceKey,
    sourceKey,
    role,
    timestamp,
    status,
    content: toContentList(value, role, thinkingStatuses),
    toolCallId: typeof value.toolCallId === "string" ? value.toolCallId : undefined,
    toolName: typeof value.toolName === "string" ? value.toolName : undefined,
    details: value.details,
    isError: typeof value.isError === "boolean" ? value.isError : undefined,
  };
}

export function toMessageList(agentMessages: readonly AgentMessage[]): Message[] {
  const sourceCounts = new Map<string, number>();
  return agentMessages.map((agentMessage) => {
    const sourceKey = getMessageSourceKey(agentMessage);
    const occurrence = sourceCounts.get(sourceKey) ?? 0;
    sourceCounts.set(sourceKey, occurrence + 1);
    return toMessage(agentMessage, "completed", `${sourceKey}:${occurrence}`);
  });
}

function createUniqueId(messages: readonly Message[], sourceKey: string): string {
  let occurrence = 0;
  let candidate = `${sourceKey}:${occurrence}`;
  const ids = new Set(messages.map((message) => message.id));
  while (ids.has(candidate)) {
    occurrence += 1;
    candidate = `${sourceKey}:${occurrence}`;
  }
  return candidate;
}

type AssistantLifecycleEvent = Extract<
  MessageStreamEvent,
  { type: "message_update" }
>["assistantMessageEvent"];

function getThinkingStatuses(
  message?: Message,
  event?: AssistantLifecycleEvent,
): Map<number, ThinkingStatus> {
  const statuses = new Map<number, ThinkingStatus>();
  message?.content.forEach((content, index) => {
    if (content.type === "thinking") statuses.set(index, content.status);
  });

  if (event?.type === "thinking_start" || event?.type === "thinking_delta") {
    statuses.set(event.contentIndex, "streaming");
  } else if (event?.type === "thinking_end") {
    statuses.set(event.contentIndex, "completed");
  } else if (event?.type === "text_start") {
    statuses.forEach((status, contentIndex) => {
      if (status === "streaming" && contentIndex < event.contentIndex) {
        statuses.set(contentIndex, "completed");
      }
    });
  }
  return statuses;
}

function replaceMessage(
  messages: readonly Message[],
  index: number,
  agentMessage: AgentMessage,
  status: Message["status"],
  assistantEvent?: AssistantLifecycleEvent,
): Message[] {
  const current = messages[index];
  const next = toMessage(
    agentMessage,
    status,
    current.id,
    getThinkingStatuses(current, assistantEvent),
  );
  return messages.map((message, messageIndex) => (messageIndex === index ? next : message));
}

export function createMessageTimeline(
  agentMessages: readonly AgentMessage[] = [],
): MessageTimeline {
  return { messages: toMessageList(agentMessages) };
}

export function applyMessageStreamEvent(
  timeline: MessageTimeline,
  event: MessageStreamEvent,
): MessageTimeline {
  const sourceKey = getMessageSourceKey(event.message);
  const activeIndex = timeline.activeMessageId
    ? timeline.messages.findIndex((message) => message.id === timeline.activeMessageId)
    : -1;
  const sourceIndex = timeline.messages.findLastIndex((message) => message.sourceKey === sourceKey);
  const existingIndex = activeIndex >= 0 ? activeIndex : sourceIndex;

  if (event.type === "message_start") {
    if (sourceIndex >= 0) {
      return {
        messages: replaceMessage(timeline.messages, sourceIndex, event.message, "streaming"),
        activeMessageId: timeline.messages[sourceIndex].id,
      };
    }
    const message = toMessage(
      event.message,
      "streaming",
      createUniqueId(timeline.messages, sourceKey),
    );
    return { messages: [...timeline.messages, message], activeMessageId: message.id };
  }

  if (existingIndex < 0) {
    const assistantEvent =
      event.type === "message_update" ? event.assistantMessageEvent : undefined;
    const message = toMessage(
      event.message,
      event.type === "message_end" ? "completed" : "streaming",
      createUniqueId(timeline.messages, sourceKey),
      getThinkingStatuses(undefined, assistantEvent),
    );
    return {
      messages: [...timeline.messages, message],
      activeMessageId: event.type === "message_end" ? undefined : message.id,
    };
  }

  return {
    messages: replaceMessage(
      timeline.messages,
      existingIndex,
      event.message,
      event.type === "message_end" ? "completed" : "streaming",
      event.type === "message_update" ? event.assistantMessageEvent : undefined,
    ),
    activeMessageId: event.type === "message_end" ? undefined : timeline.messages[existingIndex].id,
  };
}

export function formatMessageValue(value: unknown): string {
  try {
    const result = JSON.stringify(value, null, 2);
    if (result !== undefined) return result;
  } catch {
    // Fall through to the string representation.
  }
  try {
    return String(value);
  } catch {
    return "[无法显示]";
  }
}

export function getImageSource(content: Extract<MessageContent, { type: "image" }>): string {
  if (content.data.startsWith("data:")) return content.data;
  return `data:${content.mimeType};base64,${content.data}`;
}
