import type { AgentMessage } from "@mariozechner/pi-agent-core";

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null;
}

type LooseMessage = { role: string; content: unknown };

function asLooseMessage(message: AgentMessage): LooseMessage | null {
  if (!isRecord(message)) {
    return null;
  }
  const role = message.role;
  if (typeof role !== "string") {
    return null;
  }
  return { role, content: message.content };
}

/** 首轮用户消息可能是 user 或带附件的变体 */
export function isUserLikeMessage(message: AgentMessage): boolean {
  const r = asLooseMessage(message)?.role;
  return r === "user" || r === "user-with-attachments";
}

/** 从 Agent 消息中抽取可读纯文本，供标题生成等场景使用 */
export function extractPlainTextFromAgentMessage(message: AgentMessage): string {
  const loose = asLooseMessage(message);
  if (!loose) {
    return "";
  }
  const { role, content } = loose;

  if (role === "user" || role === "user-with-attachments") {
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map((part) => {
          if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
            return part.text;
          }
          return "";
        })
        .filter(Boolean)
        .join("\n");
    }
    return "";
  }

  if (role === "assistant") {
    if (!Array.isArray(content)) {
      return "";
    }
    return content
      .map((part) => {
        if (!isRecord(part)) {
          return "";
        }
        if (part.type === "text" && typeof part.text === "string") {
          return part.text;
        }
        if (part.type === "thinking" && typeof part.thinking === "string") {
          return part.thinking;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (role === "toolResult" && Array.isArray(content)) {
    return content
      .map((part) => {
        if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  return "";
}

/** 取 state.messages 中最后一条 assistant 的纯文本 */
export function lastAssistantPlainText(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const loose = asLooseMessage(messages[i]);
    if (loose?.role === "assistant") {
      return extractPlainTextFromAgentMessage(messages[i]);
    }
  }
  return "";
}

/** 取最后一条 assistant 的普通文本，忽略 thinking/reasoning 内容 */
export function lastAssistantTextOnly(messages: AgentMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const loose = asLooseMessage(messages[i]);
    if (loose?.role !== "assistant") {
      continue;
    }
    if (!Array.isArray(loose.content)) {
      return "";
    }
    return loose.content
      .map((part) => {
        if (isRecord(part) && part.type === "text" && typeof part.text === "string") {
          return part.text;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

const TITLE_MAX_LEN = 60;
const TITLE_PROMPT_MAX_CHARS = 8000;

/** 避免首轮过长内容撑爆标题模型的上下文 */
export function clipForTitlePrompt(text: string): string {
  if (text.length <= TITLE_PROMPT_MAX_CHARS) {
    return text;
  }
  return `${text.slice(0, TITLE_PROMPT_MAX_CHARS)}…`;
}

export function sanitizeSessionTitle(raw: string): string {
  let s = raw
    .trim()
    .replace(/^["'`「」]+|["'`「」]+$/g, "")
    .replace(/\s+/g, " ");
  if (s.length > TITLE_MAX_LEN) {
    s = s.slice(0, TITLE_MAX_LEN);
  }
  return s;
}
