import type { AgentMessage } from "@mariozechner/pi-agent-core";

/** 将数据库中的 content JSON 解析为 Agent 消息，坏行跳过 */
export function parseStoredSessionMessages(
  rows: { id: number; content: string }[],
): AgentMessage[] {
  const messages: AgentMessage[] = [];
  for (const row of rows) {
    try {
      messages.push(JSON.parse(row.content) as AgentMessage);
    } catch (e) {
      console.error("session_messages 解析失败，已跳过", row.id, e);
    }
  }
  return messages;
}
