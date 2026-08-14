export type MessageRole = "user" | "assistant" | "toolResult";
export type ThinkingStatus = "streaming" | "completed";

export type MessageContent =
  | {
      type: "text";
      text: string;
      textSignature?: string;
    }
  | {
      type: "localFile";
      path: string;
      name: string;
      fileType: string;
      mimeType?: string;
    }
  | {
      type: "image";
      data: string;
      mimeType: string;
      name?: string;
      fileType?: string;
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
  artifact?: TurnArtifactBundle;
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
  stopReason?: string;
  errorMessage?: string;
}

export interface MessageTimeline {
  messages: Message[];
  activeMessageId?: string;
}
import type { TurnArtifactBundle } from "@shared/api";
