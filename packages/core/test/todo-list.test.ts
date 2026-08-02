import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { describe, expect, it } from "vitest";
import {
  createTodoListTool,
  parseTodoListToolDetails,
  restoreTodoList,
  TodoListTool,
} from "../src/index.js";

const runtime = {
  cwd: process.cwd(),
  permissionMode: "full-access" as const,
};

function todoResult(
  details: unknown,
  options: { isError?: boolean; toolName?: string } = {},
): SessionTreeEntry {
  return {
    type: "message",
    id: crypto.randomUUID(),
    parentId: null,
    timestamp: new Date().toISOString(),
    message: {
      role: "toolResult",
      toolCallId: crypto.randomUUID(),
      toolName: options.toolName ?? "todoList",
      content: [{ type: "text", text: "result" }],
      details,
      isError: options.isError ?? false,
      timestamp: Date.now(),
    },
  };
}

describe("todoList tool", () => {
  it("reads, replaces, and clears the full list", async () => {
    const initialTodoList = [{ title: "Inspect code", status: "in_progress" as const }];
    const tool = createTodoListTool({ ...runtime, initialTodoList });

    const read = await tool.execute("read", {});
    expect(read.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("Inspect code"),
    });
    expect(read.details).toEqual({
      kind: "todoList",
      msg: "读取任务列表，共 1 项",
      todos: initialTodoList,
    });

    const updated = await tool.execute("update", {
      todos: [
        { title: "Inspect code", status: "done" },
        { title: "Add tests", status: "in_progress" },
      ],
    });
    expect(updated.details.todos).toEqual([
      { title: "Inspect code", status: "done" },
      { title: "Add tests", status: "in_progress" },
    ]);
    expect(updated.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("keep exactly one task in_progress"),
    });

    const cleared = await tool.execute("clear", { todos: [] });
    expect(cleared.details).toEqual({ kind: "todoList", msg: "清空任务列表", todos: [] });
    await expect(tool.execute("read-cleared", {})).resolves.toMatchObject({
      details: { todos: [] },
    });
  });

  it("keeps defensive copies and executes sequentially", async () => {
    const initialTodoList = [{ title: "Original", status: "pending" as const }];
    const tool = new TodoListTool({ ...runtime, initialTodoList });
    initialTodoList[0]!.title = "Mutated outside";

    const first = await tool.execute("first", {});
    first.details.todos[0]!.title = "Mutated result";
    const second = await tool.execute("second", {});

    expect(tool.executionMode).toBe("sequential");
    expect(second.details.todos).toEqual([{ title: "Original", status: "pending" }]);
  });

  it("rejects blank titles and invalid statuses", async () => {
    const tool = createTodoListTool(runtime);

    await expect(
      tool.execute("blank", { todos: [{ title: "   ", status: "pending" }] }),
    ).rejects.toThrow("Todo titles must not be blank");
    await expect(
      tool.execute("invalid", {
        todos: [{ title: "Task", status: "blocked" }],
      } as never),
    ).rejects.toThrow("Invalid parameters for todoList");
  });

  it("restores the latest valid successful result", () => {
    const first = {
      kind: "todoList",
      msg: "更新任务列表，共 1 项",
      todos: [{ title: "First", status: "pending" }],
    };
    const cleared = { kind: "todoList", msg: "清空任务列表", todos: [] };
    const entries = [
      todoResult(first),
      todoResult({ kind: "todoList", msg: "broken", todos: [{ title: 1 }] }),
      todoResult(cleared, { isError: true }),
      todoResult(cleared, { toolName: "read" }),
    ];

    expect(restoreTodoList(entries)).toEqual(first.todos);
    expect(restoreTodoList([...entries, todoResult(cleared)])).toEqual([]);
    expect(parseTodoListToolDetails(first)).toEqual(first);
    expect(
      parseTodoListToolDetails({ ...first, todos: [{ title: "x", status: "blocked" }] }),
    ).toBeUndefined();
  });

  it("keeps tool instances isolated", async () => {
    const first = createTodoListTool(runtime);
    const second = createTodoListTool(runtime);
    await first.execute("first", {
      todos: [{ title: "Only first session", status: "in_progress" }],
    });

    await expect(second.execute("second", {})).resolves.toMatchObject({
      details: { todos: [] },
    });
  });
});
