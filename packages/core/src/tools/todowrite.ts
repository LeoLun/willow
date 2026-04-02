import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";
import type { TodoItem, TodoStore } from "./todo-store";

export interface TodoWriteToolDetails {
  todos: TodoItem[];
}

const todoItemSchema = Type.Object({
  id: Type.String({ description: "待办事项的唯一标识" }),
  content: Type.String({ description: "待办事项的描述内容" }),
  status: Type.Union(
    [
      Type.Literal("pending"),
      Type.Literal("in_progress"),
      Type.Literal("completed"),
      Type.Literal("cancelled"),
    ],
    { description: "待办事项的状态" },
  ),
});

const todoWriteSchema = Type.Object({
  todos: Type.Array(todoItemSchema, { description: "更新后的完整待办列表" }),
});

const DESCRIPTION = `Use this tool to create and manage a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.
It also helps the user understand the progress of the task and overall progress of their requests.

## When to Use This Tool
Use this tool proactively in these scenarios:

1. Complex multistep tasks - When a task requires 3 or more distinct steps or actions
2. Non-trivial and complex tasks - Tasks that require careful planning or multiple operations
3. User explicitly requests todo list - When the user directly asks you to use the todo list
4. User provides multiple tasks - When users provide a list of things to be done (numbered or comma-separated)
5. After receiving new instructions - Immediately capture user requirements as todos. Feel free to edit the todo list based on new information.
6. After completing a task - Mark it complete and add any new follow-up tasks
7. When you start working on a new task, mark the todo as in_progress. Ideally you should only have one todo as in_progress at a time. Complete existing tasks before starting new ones.

## When NOT to Use This Tool

Skip using this tool when:
1. There is only a single, straightforward task
2. The task is trivial and tracking it provides no organizational benefit
3. The task can be completed in less than 3 trivial steps
4. The task is purely conversational or informational

## Task States and Management

1. **Task States**: Use these states to track progress:
   - pending: Task not yet started
   - in_progress: Currently working on (limit to ONE task at a time)
   - completed: Task finished successfully
   - cancelled: Task no longer needed

2. **Task Management**:
   - Update task status in real-time as you work
   - Mark tasks complete IMMEDIATELY after finishing (don't batch completions)
   - Only have ONE task in_progress at any time
   - Complete current tasks before starting new ones
   - Cancel tasks that become irrelevant

3. **Task Breakdown**:
   - Create specific, actionable items
   - Break complex tasks into smaller, manageable steps
   - Use clear, descriptive task names

When in doubt, use this tool. Being proactive with task management demonstrates attentiveness and ensures you complete all requirements successfully.`;

export function createTodoWriteTool(store: TodoStore): AgentTool<typeof todoWriteSchema> {
  return {
    name: "todowrite",
    label: "更新待办列表",
    description: DESCRIPTION,
    parameters: todoWriteSchema,
    async execute(_toolCallId, params) {
      const { todos } = params;
      store.update(todos);

      const pending = todos.filter((t) => t.status === "pending").length;
      const inProgress = todos.filter((t) => t.status === "in_progress").length;
      const completed = todos.filter((t) => t.status === "completed").length;
      const remaining = todos.filter(
        (t) => t.status !== "completed" && t.status !== "cancelled",
      ).length;

      const details: TodoWriteToolDetails = { todos };

      return {
        content: [
          {
            type: "text",
            text: `待办列表已更新：共 ${todos.length} 项，${completed} 完成，${inProgress} 进行中，${pending} 待处理，剩余 ${remaining} 项`,
          },
        ],
        details,
      };
    },
  };
}
