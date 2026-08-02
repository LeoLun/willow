// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import type { Message } from "../src/renderer/src/components/message-list";
import { getTodoListFromMessages } from "../src/renderer/src/components/todo-list/todo-list";
import TodoListPanel from "../src/renderer/src/components/todo-list/TodoListPanel.vue";

const mountedApps: App[] = [];

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

function toolResult(
  details: unknown,
  options: { isError?: boolean; toolName?: string } = {},
): Message {
  return {
    id: crypto.randomUUID(),
    sourceKey: crypto.randomUUID(),
    role: "toolResult",
    timestamp: Date.now(),
    status: "completed",
    content: [{ type: "text", text: "result" }],
    toolCallId: crypto.randomUUID(),
    toolName: options.toolName ?? "todoList",
    details,
    isError: options.isError ?? false,
  };
}

function userMessage(content: string): Message {
  return {
    id: crypto.randomUUID(),
    sourceKey: crypto.randomUUID(),
    role: "user",
    timestamp: Date.now(),
    status: "completed",
    content: [{ type: "text", text: content }],
  };
}

describe("todo list state", () => {
  it("uses the latest valid successful todoList result", () => {
    const first = {
      kind: "todoList",
      msg: "更新任务列表，共 1 项",
      todos: [{ title: "实现工具", status: "in_progress" }],
    };
    const messages = [
      toolResult(first),
      toolResult({ kind: "todoList", todos: [{ title: 1, status: "done" }] }),
      toolResult({ kind: "todoList", todos: [] }, { isError: true }),
      toolResult({ kind: "todoList", todos: [] }, { toolName: "read" }),
    ];

    expect(getTodoListFromMessages(messages)).toEqual(first.todos);
    expect(
      getTodoListFromMessages([...messages, toolResult({ kind: "todoList", todos: [] })]),
    ).toEqual([]);
  });

  it("keeps completed todos only for the latest agent loop", () => {
    const completed = toolResult({
      kind: "todoList",
      todos: [
        { title: "分析代码", status: "done" },
        { title: "完成验证", status: "done" },
      ],
    });

    expect(getTodoListFromMessages([userMessage("第一轮"), completed])).toHaveLength(2);
    expect(
      getTodoListFromMessages([userMessage("第一轮"), completed, userMessage("开始下一轮")]),
    ).toEqual([]);

    const nextLoopTodos = toolResult({
      kind: "todoList",
      todos: [{ title: "处理新任务", status: "in_progress" }],
    });
    expect(
      getTodoListFromMessages([
        userMessage("第一轮"),
        completed,
        userMessage("开始下一轮"),
        nextLoopTodos,
      ]),
    ).toEqual([{ title: "处理新任务", status: "in_progress" }]);
  });
});

describe("TodoListPanel", () => {
  it("shows the current step and reveals all statuses on hover", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      setup: () => () =>
        h(TodoListPanel, {
          items: [
            { title: "分析代码", status: "done" },
            { title: "实现功能", status: "in_progress" },
            { title: "完成验证", status: "pending" },
          ],
        }),
    });
    app.mount(container);
    mountedApps.push(app);

    const panel = container.querySelector<HTMLElement>("[data-slot=todo-list-panel]");
    const trigger = container.querySelector("[data-slot=todo-list-trigger]");
    const details = container.querySelector<HTMLElement>("[data-slot=todo-list-details]");

    expect(trigger?.textContent).toContain("第 2 / 3 步");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(details?.style.display).toBe("none");

    panel?.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(details?.style.display).not.toBe("none");
    expect(container.querySelectorAll("[data-slot=todo-list-item]")).toHaveLength(3);
    expect(container.querySelector("[data-status=done]")?.textContent).toContain("分析代码");
    expect(container.querySelector("[data-status=in_progress]")?.textContent).toContain("实现功能");
    expect(container.querySelector("[data-status=pending]")?.textContent).toContain("完成验证");
    expect(trigger?.getAttribute("aria-label")).toBe("任务进度：第 2 步，共 3 步，已完成 1 项");

    panel?.dispatchEvent(new MouseEvent("mouseleave"));
    await nextTick();
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(details?.dataset.state).toBe("closed");

    app.unmount();
    mountedApps.splice(mountedApps.indexOf(app), 1);
    const completedApp = createApp({
      setup: () => () =>
        h(TodoListPanel, {
          items: [
            { title: "分析代码", status: "done" },
            { title: "实现功能", status: "done" },
          ],
        }),
    });
    completedApp.mount(container);
    mountedApps.push(completedApp);

    expect(container.querySelector("[data-slot=todo-list-panel]")).not.toBeNull();
    expect(container.querySelector("[data-slot=todo-list-count]")?.textContent).toContain(
      "第 2 / 2 步",
    );
  });

  it("renders nothing for an explicitly cleared list", () => {
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({ setup: () => () => h(TodoListPanel, { items: [] }) });
    app.mount(container);
    mountedApps.push(app);

    expect(container.querySelector("[data-slot=todo-list-panel]")).toBeNull();
  });
});
