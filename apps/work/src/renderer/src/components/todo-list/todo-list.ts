import type { TodoItem, TodoStatus } from "@willow/core";
import type { Message } from "@/components/message-list";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return value === "pending" || value === "in_progress" || value === "done";
}

function parseTodos(details: unknown): TodoItem[] | undefined {
  if (!isRecord(details) || details.kind !== "todoList" || !Array.isArray(details.todos)) {
    return undefined;
  }

  const todos: TodoItem[] = [];
  for (const item of details.todos) {
    if (!isRecord(item) || typeof item.title !== "string" || !isTodoStatus(item.status)) {
      return undefined;
    }
    todos.push({ title: item.title, status: item.status });
  }
  return todos;
}

export function getTodoListFromMessages(messages: readonly Message[]): TodoItem[] {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user") break;
    if (
      message?.role !== "toolResult" ||
      message.toolName !== "todoList" ||
      message.isError === true
    ) {
      continue;
    }
    const todos = parseTodos(message.details);
    if (todos) return todos;
  }
  return [];
}
