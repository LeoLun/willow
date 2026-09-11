// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, shallowRef, type App } from "vue";
import {
  applyMessageStreamEvent,
  createMessageTimeline,
} from "../src/renderer/src/components/message-list/message";
import MessageTurn from "../src/renderer/src/components/message-list/MessageTurn.vue";
import { formatTurnDuration } from "../src/renderer/src/components/message-list/turn-duration";
import type { Message } from "../src/renderer/src/components/message-list/types";

vi.mock("../src/renderer/src/components/message-list/blocks/MarkdownBlock.vue", () => ({
  default: defineComponent({
    props: { content: String },
    setup: (props) => () => h("div", { "data-slot": "markdown-block" }, props.content),
  }),
}));

const apps: App[] = [];
function message(
  id: string,
  role: Message["role"],
  content: Message["content"],
  timestamp = 1000,
): Message {
  return {
    id,
    sourceKey: id,
    role,
    content,
    timestamp,
    completedAt: timestamp,
    status: "completed",
  };
}
function fixture(): Message[] {
  return [
    message("user", "user", [{ type: "text", text: "用户问题" }]),
    message("progress", "assistant", [{ type: "text", text: "先检查实现" }], 2000),
    message(
      "answer",
      "assistant",
      [
        { type: "thinking", thinking: "分析细节", status: "completed" },
        { type: "text", text: "最终回答第一段" },
        { type: "text", text: "最终回答第二段" },
      ],
      114999,
    ),
  ];
}
function mount(messages = fixture(), streaming = false) {
  const currentMessages = shallowRef(messages);
  const currentStreaming = shallowRef(streaming);
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(MessageTurn, { messages: currentMessages.value, streaming: currentStreaming.value }),
  });
  app.mount(container);
  apps.push(app);
  const trigger = () =>
    container.querySelector<HTMLButtonElement>("[data-slot=turn-process-trigger]");
  return { container, currentMessages, currentStreaming, trigger };
}
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("turn process collapse", () => {
  it("defaults history to collapsed and preserves user content and all final text blocks", async () => {
    const { container, trigger } = mount();
    const user = container.querySelector("[data-slot=user-message]");
    expect(user?.textContent).toContain("用户问题");
    expect(trigger()?.textContent).toContain("用时 1m 53s");
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("先检查实现");
    expect(container.querySelector("[data-slot=thinking-block]")).toBeNull();
    expect(container.textContent).toContain("最终回答第一段");
    expect(container.textContent).toContain("最终回答第二段");
    trigger()?.click();
    await nextTick();
    await vi.waitFor(() => expect(container.textContent).toContain("先检查实现"));
    expect(container.querySelector("[data-slot=thinking-block]")).not.toBeNull();
    expect(
      container.querySelectorAll("[data-slot=assistant-message] [data-slot=message-toolbar]"),
    ).toHaveLength(1);
    expect(container.querySelector("[data-slot=user-message]")).toBe(user);
    trigger()?.click();
    await nextTick();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
  });

  it("automatically collapses at each streaming end but preserves manual expansion on ordinary updates", async () => {
    const { container, currentMessages, currentStreaming, trigger } = mount(fixture(), true);
    expect(trigger()).toBeNull();
    expect(container.textContent).toContain("先检查实现");
    currentStreaming.value = false;
    await nextTick();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    trigger()?.click();
    await nextTick();
    currentMessages.value = [...currentMessages.value];
    await nextTick();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("true");
    currentStreaming.value = true;
    await nextTick();
    expect(trigger()).toBeNull();
    expect(container.textContent).toContain("先检查实现");
    currentStreaming.value = false;
    await nextTick();
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
  });

  it("omits the header for a plain answer or user-only turn", () => {
    expect(
      mount([message("answer", "assistant", [{ type: "text", text: "回答" }])]).trigger(),
    ).toBeNull();
    expect(mount([fixture()[0]]).trigger()).toBeNull();
  });

  it("collapses tool-only output and keeps assistant errors visible without duplication", async () => {
    const { container, trigger } = mount([
      fixture()[0],
      message("call", "assistant", [
        { type: "toolCall", id: "read", name: "read", arguments: { path: "a.ts" } },
      ]),
      {
        ...message("error", "assistant", [], 4000),
        stopReason: "error",
        errorMessage: "服务暂不可用",
      },
    ]);
    expect(trigger()?.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("[data-slot=tool-message]")).toBeNull();
    expect(container.textContent).toContain("服务暂不可用");
    trigger()?.click();
    await nextTick();
    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=tool-message]")).not.toBeNull(),
    );
    expect(container.querySelectorAll("[role=alert]")).toHaveLength(1);
  });

  it.each([false, true])(
    "shows one error for an assistant split around tools (text: %s)",
    async (withText) => {
      const content: Message["content"] = [
        { type: "toolCall", id: "read", name: "read", arguments: { path: "a.ts" } },
      ];
      if (withText) {
        content.unshift({ type: "text", text: "调用前" });
        content.push({ type: "text", text: "调用后" });
      }
      const { container, trigger } = mount([
        {
          ...message("failed", "assistant", content),
          stopReason: "error",
          errorMessage: "失败详情",
        },
      ]);
      expect(container.querySelectorAll("[role=alert]")).toHaveLength(1);
      trigger()?.click();
      await vi.waitFor(() =>
        expect(container.querySelector("[data-slot=tool-message]")).not.toBeNull(),
      );
      expect(container.querySelectorAll("[role=alert]")).toHaveLength(1);
    },
  );

  it("keeps final artifacts and toolbar outside the process and renders them once", async () => {
    const messages = fixture();
    messages[2].artifact = {
      version: 1,
      assistantTimestamp: 114999,
      files: [{ path: "a.ts", status: "modified", additions: 1, deletions: 0 }],
      plans: [],
    };
    const { container, trigger } = mount(messages);
    const artifact = container.querySelector("[data-slot=artifact-area]");
    expect(artifact).not.toBeNull();
    expect(artifact?.closest("[data-slot=turn-process]")).toBeNull();
    trigger()?.click();
    await nextTick();
    expect(container.querySelectorAll("[data-slot=artifact-area]")).toHaveLength(1);
    expect(
      container.querySelectorAll("[data-slot=assistant-message] [data-slot=message-toolbar]"),
    ).toHaveLength(1);
  });
});

describe("completed turn duration", () => {
  it.each([
    [1000, 1999, "用时 <1s"],
    [1000, 60000, "用时 59s"],
    [1000, 61000, "用时 1m"],
    [1000, 3662000, "用时 1h 1m 1s"],
    [2000, 1000, "用时未知"],
    [0, 5000, "用时未知"],
    [1000, Number.NaN, "用时未知"],
  ])("formats %s to %s as %s", (start, end, expected) => {
    expect(
      formatTurnDuration([message("u", "user", [], start), message("a", "assistant", [], end)]),
    ).toBe(expected);
  });
  it("uses actual completion for live and reloaded messages even when creation timestamps are equal", () => {
    const user = { role: "user", content: "问题", timestamp: 1000 } as const;
    const assistant = {
      role: "assistant",
      content: [{ type: "text", text: "回答" }],
      timestamp: 1000,
    } as any;
    let live = createMessageTimeline([user]);
    live = applyMessageStreamEvent(live, { type: "start", message: assistant });
    live = applyMessageStreamEvent(live, { type: "end", message: assistant, completedAt: 114000 });
    expect(formatTurnDuration(live.messages)).toBe("用时 1m 53s");
    expect(live.messages[1].timestamp).toBe(1000);
    expect(
      formatTurnDuration(
        createMessageTimeline([user, { ...assistant, completedAt: 114000 }]).messages,
      ),
    ).toBe("用时 1m 53s");
    const endWithoutStart = applyMessageStreamEvent(createMessageTimeline([user]), {
      type: "end",
      message: assistant,
      completedAt: 114000,
    });
    expect(formatTurnDuration(endWithoutStart.messages)).toBe("用时 1m 53s");
    expect(formatTurnDuration(createMessageTimeline([user, assistant]).messages)).toBe("用时未知");
  });
  it("does not invent a duration when the user or completion time is missing", () => {
    expect(
      formatTurnDuration([
        message("a", "assistant", [], 1000),
        message("t", "toolResult", [], 4000),
      ]),
    ).toBe("用时未知");
    expect(formatTurnDuration([])).toBe("用时未知");
    expect(formatTurnDuration([fixture()[0]])).toBe("用时未知");
  });
});
