export type MessageRole = "user" | "assistant" | "toolResult";
export type ThinkingStatus = "streaming" | "completed";

export type MessageContent =
  | {
      type: "text";
      text: string;
      textSignature?: string;
    }
  | {
      type: "image";
      data: string;
      mimeType: string;
    }
  | {
      type: "thinking";
      thinking: string;
      thinkingSignature?: string;
      redacted?: boolean;
      status: ThinkingStatus;
    }
  | {
      type: "toolCall";
      id: string;
      name: string;
      arguments: unknown;
      thoughtSignature?: string;
    }
  | {
      type: "unknown";
      nodeType: string;
      value: unknown;
    };

export type ToolCallContent = Extract<MessageContent, { type: "toolCall" }>;

export interface Message {
  id: string;
  sourceKey: string;
  role: MessageRole;
  timestamp: number;
  status: "streaming" | "completed";
  content: MessageContent[];
  toolCallId?: string;
  toolName?: string;
  details?: unknown;
  isError?: boolean;
}

export interface MessageTimeline {
  messages: Message[];
  activeMessageId?: string;
}
