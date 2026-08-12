import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { MessageStreamEvent } from "@shared/api";
import { parseLocalFilePrompt } from "@shared/local-file";
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
  stopReason?: unknown;
  errorMessage?: unknown;
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
    return {
      type: "image",
      data: content.data,
      mimeType: content.mimeType,
      ...(typeof content.name === "string" && content.name !== "" ? { name: content.name } : {}),
      ...(typeof content.fileType === "string" && content.fileType !== ""
        ? { fileType: content.fileType }
        : {}),
    };
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

function toUserTextContent(text: string, textSignature?: string): MessageContent[] {
  const parsed = parseLocalFilePrompt(text);
  if (!parsed.grant) {
    if (text === "") return [];
    return [{ type: "text", text, ...(textSignature ? { textSignature } : {}) }];
  }
  return [
    ...(parsed.content
      ? ([
          {
            type: "text",
            text: parsed.content,
            ...(textSignature ? { textSignature } : {}),
          },
        ] satisfies MessageContent[])
      : []),
    ...parsed.grant.files.map((file) => ({ type: "localFile" as const, ...file })),
  ];
}

function toContentList(
  message: AgentMessageLike,
  role: MessageRole,
  thinkingStatuses?: ReadonlyMap<number, ThinkingStatus>,
): MessageContent[] {
  if (role === "user" && typeof message.content === "string") {
    return toUserTextContent(message.content);
  }
  if (!Array.isArray(message.content)) {
    return [toUnknownContent(message.content, "content")];
  }
  if (role === "user") {
    return message.content.flatMap((value) => {
      const content = asObject(value) as ContentLike | undefined;
      if (content?.type === "text" && typeof content.text === "string") {
        return toUserTextContent(
          content.text,
          typeof content.textSignature === "string" ? content.textSignature : undefined,
        );
      }
      return [toContent(value)];
    });
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
    stopReason: typeof value.stopReason === "string" ? value.stopReason : undefined,
    errorMessage: typeof value.errorMessage === "string" ? value.errorMessage : undefined,
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

function getThinkingStatuses(message?: Message): Map<number, ThinkingStatus> {
  const statuses = new Map<number, ThinkingStatus>();
  message?.content.forEach((content, index) => {
    if (content.type === "thinking") statuses.set(index, content.status);
  });
  return statuses;
}

function replaceMessage(
  messages: readonly Message[],
  index: number,
  agentMessage: AgentMessage,
  status: Message["status"],
): Message[] {
  const current = messages[index];
  const next = toMessage(agentMessage, status, current.id, getThinkingStatuses(current));
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
  const activeIndex = timeline.activeMessageId
    ? timeline.messages.findIndex((message) => message.id === timeline.activeMessageId)
    : -1;
  const sourceKey = event.type === "update" ? undefined : getMessageSourceKey(event.message);
  const sourceIndex =
    event.type === "update"
      ? timeline.messages.findLastIndex(
          (message) => message.role === "assistant" && message.timestamp === event.messageTimestamp,
        )
      : timeline.messages.findLastIndex((message) => message.sourceKey === sourceKey);
  const existingIndex = activeIndex >= 0 ? activeIndex : sourceIndex;

  if (event.type === "start") {
    if (sourceIndex >= 0) {
      return {
        messages: replaceMessage(timeline.messages, sourceIndex, event.message, "streaming"),
        activeMessageId: timeline.messages[sourceIndex].id,
      };
    }
    const message = toMessage(
      event.message,
      "streaming",
      createUniqueId(timeline.messages, sourceKey!),
    );
    return { messages: [...timeline.messages, message], activeMessageId: message.id };
  }

  if (existingIndex < 0) {
    if (event.type === "update") return timeline;
    const message = toMessage(
      event.message,
      event.type === "end" ? "completed" : "streaming",
      createUniqueId(timeline.messages, sourceKey!),
    );
    return {
      messages: [...timeline.messages, message],
      activeMessageId: event.type === "end" ? undefined : message.id,
    };
  }

  if (event.type === "update") {
    let next = timeline.messages[existingIndex];
    const content = [...next.content];
    for (const patch of event.patches) {
      if (patch.type === "text_delta") {
        const current = content[patch.contentIndex];
        content[patch.contentIndex] = {
          type: "text",
          text: (current?.type === "text" ? current.text : "") + patch.delta,
          ...(current?.type === "text" && current.textSignature
            ? { textSignature: current.textSignature }
            : {}),
        };
        continue;
      }
      if (patch.type === "thinking_delta") {
        const current = content[patch.contentIndex];
        content[patch.contentIndex] = {
          type: "thinking",
          thinking: (current?.type === "thinking" ? current.thinking : "") + patch.delta,
          ...(current?.type === "thinking" && current.thinkingSignature
            ? { thinkingSignature: current.thinkingSignature }
            : {}),
          ...(current?.type === "thinking" && current.redacted ? { redacted: true } : {}),
          status: "streaming",
        };
        continue;
      }

      if (patch.type === "text_start") {
        content.forEach((item, index) => {
          if (
            index < patch.contentIndex &&
            item.type === "thinking" &&
            item.status === "streaming"
          ) {
            content[index] = { ...item, status: "completed" };
          }
        });
      }
      const thinkingStatus =
        patch.type === "thinking_start"
          ? "streaming"
          : patch.type === "thinking_end"
            ? "completed"
            : undefined;
      if ("content" in patch) {
        content[patch.contentIndex] = toContent(patch.content, thinkingStatus);
      }
    }
    next = { ...next, content, status: "streaming" };
    return {
      messages: timeline.messages.map((message, index) =>
        index === existingIndex ? next : message,
      ),
      activeMessageId: next.id,
    };
  }

  return {
    messages: replaceMessage(timeline.messages, existingIndex, event.message, "completed"),
    activeMessageId: undefined,
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
