import type { AgentTool } from "@earendil-works/pi-agent-core";
import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { Type, type Static } from "typebox";
import { ToolBase, type ToolExecutionContext } from "./base.js";
import type { BaseDetails, ToolRuntimeOptions } from "./types.js";

export const TODO_LIST_TOOL_NAME = "todoList" as const;

const TODO_LIST_WRITE_REMINDER =
  "Continue using the todo list to track progress. Mark tasks done immediately after finishing " +
  "them, and keep exactly one task in_progress while work is underway.";

const todoStatusSchema = Type.Union([
  Type.Literal("pending"),
  Type.Literal("in_progress"),
  Type.Literal("done"),
]);

const todoItemSchema = Type.Object({
  title: Type.String({ minLength: 1, description: "Short, actionable title for the todo." }),
  status: todoStatusSchema,
});

export const todoListSchema = Type.Object({
  todos: Type.Optional(
    Type.Array(todoItemSchema, {
      description:
        "The updated todo list. Omit to read the current list. Pass an empty array to clear it.",
    }),
  ),
});

export type TodoStatus = Static<typeof todoStatusSchema>;
export type TodoItem = Static<typeof todoItemSchema>;
export type TodoListInput = Static<typeof todoListSchema>;

export interface TodoListToolDetails extends BaseDetails {
  kind: "todoList";
  todos: TodoItem[];
}

function cloneTodos(todos: readonly TodoItem[]): TodoItem[] {
  return todos.map((todo) => ({ title: todo.title, status: todo.status }));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isTodoStatus(value: unknown): value is TodoStatus {
  return value === "pending" || value === "in_progress" || value === "done";
}

export function parseTodoListToolDetails(value: unknown): TodoListToolDetails | undefined {
  if (!isRecord(value) || value.kind !== "todoList" || typeof value.msg !== "string") {
    return undefined;
  }
  if (!Array.isArray(value.todos)) return undefined;

  const todos: TodoItem[] = [];
  for (const item of value.todos) {
    if (!isRecord(item) || typeof item.title !== "string" || !isTodoStatus(item.status)) {
      return undefined;
    }
    todos.push({ title: item.title, status: item.status });
  }
  return { kind: "todoList", msg: value.msg, todos };
}

export function restoreTodoList(entries: readonly SessionTreeEntry[]): TodoItem[] {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index];
    if (entry?.type !== "message") continue;

    const message = entry.message;
    if (
      message.role !== "toolResult" ||
      message.toolName !== TODO_LIST_TOOL_NAME ||
      message.isError
    ) {
      continue;
    }
    const details = parseTodoListToolDetails(message.details);
    if (details) return details.todos;
  }
  return [];
}

export function renderTodoList(todos: readonly TodoItem[], title = "Current todo list:"): string {
  if (todos.length === 0) return "Todo list is empty.";
  return [title, ...todos.map((todo) => `  [${todo.status}] ${todo.title}`)].join("\n");
}

export class TodoListTool extends ToolBase<typeof todoListSchema, TodoListToolDetails> {
  readonly name = TODO_LIST_TOOL_NAME;
  readonly label = "Todo List";
  readonly description = `Use this tool to maintain a structured TODO list for multi-step work.

Call it with todos to replace the full list, with an empty array to clear the list, or omit todos
to read the current list. Keep titles short and actionable. Before starting tracked work, mark
exactly one item in_progress. Mark finished work done immediately and avoid updates when nothing
meaningful changed. Do not use this tool for trivial or purely conversational requests.`;
  readonly parameters = todoListSchema;
  readonly executionMode = "sequential" as const;
  private todos: TodoItem[];

  constructor(options: ToolRuntimeOptions) {
    super(options);
    this.todos = cloneTodos(options.initialTodoList ?? []);
  }

  protected override checkParams(input: TodoListInput): Error | undefined {
    if (input.todos?.some((todo) => todo.title.trim() === "")) {
      return new Error("Todo titles must not be blank");
    }
    return undefined;
  }

  protected override async run(context: ToolExecutionContext<TodoListInput, TodoListToolDetails>) {
    const { todos } = context.input;
    if (todos !== undefined) this.todos = cloneTodos(todos);

    const stored = cloneTodos(this.todos);
    const action =
      todos === undefined ? "读取任务列表" : stored.length === 0 ? "清空任务列表" : "更新任务列表";
    const output =
      todos === undefined
        ? renderTodoList(stored)
        : stored.length === 0
          ? "Todo list cleared."
          : `Todo list updated.\n${renderTodoList(stored)}\n\n${TODO_LIST_WRITE_REMINDER}`;

    return this.buildResponse([{ type: "text", text: output }], {
      kind: "todoList",
      msg: stored.length === 0 ? action : `${action}，共 ${stored.length} 项`,
      todos: stored,
    });
  }
}

export function createTodoListTool(
  options: ToolRuntimeOptions,
): AgentTool<typeof todoListSchema, TodoListToolDetails> {
  return new TodoListTool(options);
}
