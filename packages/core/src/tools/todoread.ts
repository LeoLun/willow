import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { TodoItem, TodoStore } from "./todo-store";

export interface TodoReadToolDetails {
  todos: TodoItem[];
}

const todoReadSchema = Type.Object({});

const DESCRIPTION = `Use this tool to read the current to-do list for the session. This tool should be used proactively and frequently to ensure that you are aware of
the status of the current task list. You should make use of this tool as often as possible, especially in the following situations:
- At the beginning of conversations to see what's pending
- Before starting new tasks to prioritize work
- When the user asks about previous tasks or plans
- Whenever you're uncertain about what to do next
- After completing tasks to update your understanding of remaining work
- After every few messages to ensure you're on track

Usage:
- This tool takes in no parameters. So leave the input blank or empty.
- Returns a list of todo items with their status and content
- Use this information to track progress and plan next steps
- If no todos exist yet, an empty list will be returned`;

export function createTodoReadTool(store: TodoStore): AgentTool<typeof todoReadSchema> {
  return {
    name: "todoread",
    label: "读取待办列表",
    description: DESCRIPTION,
    parameters: todoReadSchema,
    async execute() {
      const todos = store.get();
      const remaining = todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length;

      const details: TodoReadToolDetails = { todos };

      return {
        content: [
          {
            type: "text",
            text:
              todos.length > 0
                ? `当前有 ${todos.length} 个待办事项（${remaining} 项未完成）：\n${JSON.stringify(todos, null, 2)}`
                : "当前没有待办事项。",
          },
        ],
        details,
      };
    },
  };
}
