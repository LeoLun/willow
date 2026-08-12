import type { Message } from "./types";

export type MessageTurnGroup = { key: string; messages: Message[] };

export function groupMessagesIntoTurns(messages: readonly Message[]): MessageTurnGroup[] {
  const turns: MessageTurnGroup[] = [];
  for (const message of messages) {
    if (message.role === "user" || turns.length === 0) {
      turns.push({ key: `turn:${message.id}`, messages: [message] });
    } else {
      turns[turns.length - 1].messages.push(message);
    }
  }
  return turns;
}
