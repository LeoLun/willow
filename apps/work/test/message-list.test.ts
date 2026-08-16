// @vitest-environment jsdom

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { MessageStreamEvent } from "@shared/api";
import { appendLocalFileBlock } from "@shared/local-file";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, shallowRef } from "vue";
import {
  applyMessageStreamEvent,
  createMessageTimeline,
  MessageList,
  toMessage,
  toMessageList,
  type Message,
} from "../src/renderer/src/components/message-list";
import {
  formatMessageTimestamp,
  getMessageCopyText,
} from "../src/renderer/src/components/message-list/message-toolbar";

const mountedApps: ReturnType<typeof createApp>[] = [];

function agentMessage(value: unknown): AgentMessage {
  return value as AgentMessage;
}

function streamEvent(value: unknown): MessageStreamEvent {
  const event = value as any;
  if (event.type === "message_start") return { type: "start", message: event.message };
  if (event.type === "message_end") return { type: "end", message: event.message };
  if (event.type === "message_update") {
    const update = event.assistantMessageEvent;
    const patches = event.message.content.map((content: any, contentIndex: number) => ({
      type:
        contentIndex === update.contentIndex && update.type.endsWith("_end")
          ? update.type
          : content.type === "thinking"
            ? "thinking_start"
            : content.type === "toolCall"
              ? "toolcall_end"
              : "text_start",
      contentIndex,
      content,
    }));
    return { type: "update", messageTimestamp: event.message.timestamp, patches } as any;
  }
  return event as MessageStreamEvent;
}

function mountMessageList(messages: Message[], streaming = false) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => h(MessageList, { messages, streaming }) });
  app.mount(container);
  mountedApps.push(app);
  return container;
}

function mountReactiveMessageList(message: Message) {
  const container = document.createElement("div");
  const currentMessage = shallowRef(message);
  document.body.append(container);
  const app = createApp({
    render: () => h(MessageList, { messages: [currentMessage.value] }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, currentMessage };
}

function mountReactiveMessages(messages: Message[], streaming = false) {
  const container = document.createElement("div");
  const currentMessages = shallowRef(messages);
  const currentStreaming = shallowRef(streaming);
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(MessageList, {
        messages: currentMessages.value,
        streaming: currentStreaming.value,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, currentMessages, currentStreaming };
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("pi-agent message conversion", () => {
  it("preserves every supported content node and tool-result metadata", () => {
    const messages = toMessageList([
      agentMessage({
        role: "user",
        content: [
          { type: "text", text: "查看图片" },
          { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
        ],
        timestamp: 1,
      }),
      agentMessage({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "先分析", thinkingSignature: "thinking-signature" },
          {
            type: "toolCall",
            id: "call-1",
            name: "read_file",
            arguments: { path: "work.vue" },
            thoughtSignature: "tool-signature",
          },
          { type: "text", text: "完成" },
        ],
        timestamp: 2,
      }),
      agentMessage({
        role: "toolResult",
        toolCallId: "call-1",
        toolName: "read_file",
        content: [{ type: "text", text: "文件内容" }],
        details: { bytes: 10 },
        isError: false,
        timestamp: 3,
      }),
    ]);

    expect(messages).toHaveLength(3);
    expect(messages[0].content).toEqual([
      { type: "text", text: "查看图片", textSignature: undefined },
      { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
    ]);
    expect(messages[1].content).toMatchObject([
      {
        type: "thinking",
        thinking: "先分析",
        thinkingSignature: "thinking-signature",
        status: "completed",
      },
      {
        type: "toolCall",
        id: "call-1",
        name: "read_file",
        arguments: { path: "work.vue" },
      },
      { type: "text", text: "完成" },
    ]);
    expect(messages[2]).toMatchObject({
      role: "toolResult",
      toolCallId: "call-1",
      toolName: "read_file",
      details: { bytes: 10 },
      isError: false,
    });
  });

  it("keeps redacted, unknown, and malformed nodes visible", () => {
    const message = toMessage(
      agentMessage({
        role: "assistant",
        content: [
          { type: "thinking", thinking: "encrypted", redacted: true },
          { type: "futureNode", payload: "future" },
          null,
        ],
        timestamp: 4,
      }),
    );

    expect(message.content).toEqual([
      {
        type: "thinking",
        thinking: "encrypted",
        thinkingSignature: undefined,
        redacted: true,
        status: "completed",
      },
      {
        type: "unknown",
        nodeType: "futureNode",
        value: { type: "futureNode", payload: "future" },
      },
      { type: "unknown", nodeType: "unknown", value: null },
    ]);
  });

  it("preserves and renders provider errors returned by the agent", () => {
    const message = toMessage(
      agentMessage({
        role: "assistant",
        content: [],
        stopReason: "error",
        errorMessage: "503: Service is too busy",
        timestamp: 5,
      }),
    );

    expect(message).toMatchObject({
      stopReason: "error",
      errorMessage: "503: Service is too busy",
    });

    const container = mountMessageList([message]);
    const alert = container.querySelector('[data-slot="assistant-error"]');
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.textContent).toContain("模型服务请求失败");
    expect(alert?.textContent).toContain("503: Service is too busy");
  });

  it("adds occurrence suffixes when source identities collide", () => {
    const duplicate = agentMessage({ role: "user", content: "same time", timestamp: 5 });
    const messages = toMessageList([duplicate, duplicate]);

    expect(messages.map((message) => message.id)).toEqual(["user:5::0", "user:5::1"]);
  });

  it("separates persisted local file metadata from visible user text", () => {
    const content = appendLocalFileBlock("Review this", {
      requestId: "request-1",
      files: [{ path: "/tmp/design.md", name: "design.md", fileType: "MD" }],
    });
    const message = toMessage(
      agentMessage({
        role: "user",
        content: [{ type: "text", text: content }],
        timestamp: 6,
      }),
    );

    expect(message.content).toEqual([
      { type: "text", text: "Review this" },
      { type: "localFile", path: "/tmp/design.md", name: "design.md", fileType: "MD" },
    ]);
    const container = mountMessageList([message]);
    expect(container.textContent).toContain("Review this");
    expect(container.textContent).toContain("design.md");
    expect(container.textContent).not.toContain("willow_local_files");
    expect(container.querySelector('[data-slot="user-message-attachments"]')?.textContent).toBe(
      "design.md",
    );
    const attachmentList = container.querySelector<HTMLElement>(
      '[data-slot="user-message-attachments"]',
    )!;
    expect([...attachmentList.classList]).toEqual(
      expect.arrayContaining(["overflow-x-auto", "overflow-y-hidden"]),
    );
    expect([...(attachmentList.firstElementChild?.classList ?? [])]).toEqual(
      expect.arrayContaining(["flex", "w-max", "flex-nowrap"]),
    );
    expect(
      container.querySelector('[data-slot="local-file-card"]')?.getAttribute("data-variant"),
    ).toBe("compact");
    expect(container.querySelector('[data-slot="user-message-body"]')?.textContent).toBe(
      "Review this",
    );
  });

  it("renders a file-only user message without an empty text bubble", () => {
    const content = appendLocalFileBlock("", {
      requestId: "request-2",
      files: [{ path: "/tmp/plan.md", name: "plan.md", fileType: "MD" }],
    });
    const container = mountMessageList([
      toMessage(agentMessage({ role: "user", content, timestamp: 7 })),
    ]);

    expect(container.querySelector('[data-slot="user-message-attachments"]')?.textContent).toBe(
      "plan.md",
    );
    expect(container.querySelector('[data-slot="user-message-body"]')).toBeNull();
  });

  it("keeps malformed attachment markers visible as plain text", () => {
    const content = "Review\n\n<willow_local_files>\nnot-json\n</willow_local_files>";
    const message = toMessage(agentMessage({ role: "user", content, timestamp: 7 }));
    expect(message.content).toEqual([{ type: "text", text: content }]);
  });

  it("renders user message images using LocalFileCard with thumbnail", () => {
    const message: Message = {
      id: "user-img",
      sourceKey: "user-img",
      role: "user",
      timestamp: 8,
      status: "completed",
      content: [
        { type: "text", text: "图片内容是什么" },
        { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
      ],
    };
    const container = mountMessageList([message]);
    expect(container.querySelector('[data-slot="user-message-attachments"]')).not.toBeNull();
    const fileCard = container.querySelector('[data-slot="local-file-card"]');
    expect(fileCard).not.toBeNull();
    const img = fileCard?.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toContain("data:image/png;base64,aGVsbG8=");
  });

  it("deduplicates localFile and image content for the same attachment into a single card", () => {
    const message: Message = {
      id: "user-dedup",
      sourceKey: "user-dedup",
      role: "user",
      timestamp: 9,
      status: "completed",
      content: [
        { type: "text", text: "图片内容是什么" },
        {
          type: "localFile",
          path: "/tmp/codex.png",
          name: "codex.png",
          fileType: "PNG",
        },
        {
          type: "image",
          data: "aGVsbG8=",
          mimeType: "image/png",
          name: "codex.png",
          fileType: "PNG",
        },
      ],
    };
    const container = mountMessageList([message]);
    const cards = container.querySelectorAll('[data-slot="local-file-card"]');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain("codex.png");
    expect(cards[0].querySelector("img")?.getAttribute("src")).toContain(
      "data:image/png;base64,aGVsbG8=",
    );
  });
});

describe("pi-agent message lifecycle", () => {
  it("deduplicates a historical user message when buffered lifecycle events are replayed", () => {
    const user = agentMessage({ role: "user", content: "hello", timestamp: 10 });
    let timeline = createMessageTimeline([user]);

    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({ type: "message_start", message: user }),
    );
    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({ type: "message_end", message: user }),
    );

    expect(timeline.messages).toHaveLength(1);
    expect(timeline.messages[0]).toMatchObject({ role: "user", status: "completed" });
    expect(timeline.activeMessageId).toBeUndefined();
  });

  it("replaces the complete assistant partial across text, thinking, and tool-call updates", () => {
    const start = agentMessage({ role: "assistant", content: [], timestamp: 20 });
    const partial = agentMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "checking" },
        { type: "toolCall", id: "call", name: "read", arguments: { path: "a.ts" } },
      ],
      timestamp: 20,
    });
    const completed = agentMessage({
      role: "assistant",
      content: [...(partial as { content: unknown[] }).content, { type: "text", text: "done" }],
      timestamp: 20,
    });
    let timeline = createMessageTimeline();

    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({ type: "message_start", message: start }),
    );
    const id = timeline.messages[0].id;
    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({
        type: "message_update",
        message: partial,
        assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
      }),
    );

    expect(timeline.messages).toHaveLength(1);
    expect(timeline.messages[0].id).toBe(id);
    expect(timeline.messages[0].content.map((content) => content.type)).toEqual([
      "thinking",
      "toolCall",
    ]);
    expect(timeline.messages[0].status).toBe("streaming");
    expect(timeline.messages[0].content[0]).toMatchObject({
      type: "thinking",
      status: "streaming",
    });

    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({
        type: "message_update",
        message: partial,
        assistantMessageEvent: {
          type: "thinking_end",
          contentIndex: 0,
          content: "checking",
        },
      }),
    );

    expect(timeline.messages[0].status).toBe("streaming");
    expect(timeline.messages[0].content[0]).toMatchObject({
      type: "thinking",
      status: "completed",
    });

    const withText = agentMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "checking" },
        { type: "text", text: "" },
      ],
      timestamp: 20,
    });
    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({
        type: "message_update",
        message: withText,
        assistantMessageEvent: { type: "text_start", contentIndex: 1 },
      }),
    );

    expect(timeline.messages[0].status).toBe("streaming");
    expect(timeline.messages[0].content[0]).toMatchObject({
      type: "thinking",
      status: "completed",
    });

    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({ type: "message_end", message: completed }),
    );
    expect(timeline.messages[0].content.map((content) => content.type)).toEqual([
      "thinking",
      "toolCall",
      "text",
    ]);
    expect(timeline.messages[0].status).toBe("completed");
  });

  it("finishes an earlier thinking block when text starts without a thinking-end event", () => {
    const start = agentMessage({ role: "assistant", content: [], timestamp: 21 });
    const thinking = agentMessage({
      role: "assistant",
      content: [{ type: "thinking", thinking: "checking" }],
      timestamp: 21,
    });
    const withText = agentMessage({
      role: "assistant",
      content: [
        { type: "thinking", thinking: "checking" },
        { type: "text", text: "" },
      ],
      timestamp: 21,
    });
    let timeline = createMessageTimeline();

    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({ type: "message_start", message: start }),
    );
    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({
        type: "message_update",
        message: thinking,
        assistantMessageEvent: { type: "thinking_start", contentIndex: 0 },
      }),
    );
    timeline = applyMessageStreamEvent(
      timeline,
      streamEvent({
        type: "message_update",
        message: withText,
        assistantMessageEvent: { type: "text_start", contentIndex: 1 },
      }),
    );

    expect(timeline.messages[0].status).toBe("streaming");
    expect(timeline.messages[0].content[0]).toMatchObject({
      type: "thinking",
      status: "completed",
    });
  });

  it("keeps assistant, tool result, and following assistant messages in lifecycle order", () => {
    const firstAssistant = agentMessage({ role: "assistant", content: [], timestamp: 30 });
    const toolResult = agentMessage({
      role: "toolResult",
      toolCallId: "call",
      toolName: "read",
      content: [{ type: "text", text: "result" }],
      isError: false,
      timestamp: 31,
    });
    const secondAssistant = agentMessage({ role: "assistant", content: [], timestamp: 32 });
    let timeline = createMessageTimeline();

    for (const message of [firstAssistant, toolResult, secondAssistant]) {
      timeline = applyMessageStreamEvent(timeline, streamEvent({ type: "message_start", message }));
      timeline = applyMessageStreamEvent(timeline, streamEvent({ type: "message_end", message }));
    }

    expect(timeline.messages.map((message) => message.role)).toEqual([
      "assistant",
      "toolResult",
      "assistant",
    ]);
  });
});

describe("MessageList", () => {
  it("formats message timestamps in the local calendar week", () => {
    const now = new Date(2025, 0, 8, 12, 0);

    expect(formatMessageTimestamp(new Date(2025, 0, 8, 9, 5).getTime(), now)).toBe("09:05");
    expect(formatMessageTimestamp(new Date(2025, 0, 6, 18, 7).getTime(), now)).toBe("周一 18:07");
    expect(formatMessageTimestamp(new Date(2025, 0, 12, 23, 9).getTime(), now)).toBe("周日 23:09");
    expect(formatMessageTimestamp(new Date(2025, 0, 5, 8, 3).getTime(), now)).toBe(
      "2025年01月05日 08:03",
    );
    expect(formatMessageTimestamp(new Date(2024, 11, 31, 7, 2).getTime(), now)).toBe(
      "2024年12月31日 07:02",
    );
  });

  it("shows the user toolbar on interaction and copies only original text content", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2025, 0, 8, 12, 0));
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      const message: Message = {
        id: "user",
        sourceKey: "user",
        role: "user",
        timestamp: new Date(2025, 0, 8, 9, 5).getTime(),
        status: "completed",
        content: [
          { type: "text", text: "查看 [文件](apps/work/a.ts)" },
          { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
          { type: "thinking", thinking: "不复制", status: "completed" },
          { type: "text", text: "**保留 Markdown**" },
        ],
      };
      const container = mountMessageList([message]);
      const toolbar = container.querySelector("[data-slot=message-toolbar]");
      const copyButton = toolbar?.querySelector<HTMLButtonElement>("[data-slot=message-copy]");

      expect(toolbar?.getAttribute("data-visibility")).toBe("interaction");
      expect(toolbar?.classList.contains("opacity-0")).toBe(true);
      expect(toolbar?.classList.contains("group-hover/message:opacity-100")).toBe(true);
      expect(toolbar?.classList.contains("group-focus-within/message:opacity-100")).toBe(true);
      expect(toolbar?.querySelector("[data-slot=message-timestamp]")?.textContent?.trim()).toBe(
        "09:05",
      );
      expect(copyButton?.getAttribute("aria-label")).toBe("复制消息");
      expect(copyButton?.getAttribute("data-copy-state")).toBe("idle");
      expect(copyButton?.querySelector('[data-icon="copy"]')).not.toBeNull();
      expect(copyButton?.disabled).toBe(false);
      expect(getMessageCopyText(message)).toBe("查看 [文件](apps/work/a.ts)\n\n**保留 Markdown**");

      copyButton?.focus();
      expect(document.activeElement).toBe(copyButton);
      copyButton?.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      await Promise.resolve();
      await nextTick();
      expect(writeText).toHaveBeenCalledWith("查看 [文件](apps/work/a.ts)\n\n**保留 Markdown**");
      expect(document.activeElement).not.toBe(copyButton);
      expect(copyButton?.getAttribute("aria-label")).toBe("已复制");
      expect(copyButton?.getAttribute("data-copy-state")).toBe("copied");
      expect(copyButton?.classList.contains("bg-accent")).toBe(true);
      expect(copyButton?.querySelector('[data-icon="check"]')).not.toBeNull();
      expect(copyButton?.querySelector('[data-icon="copy"]')).toBeNull();

      await vi.advanceTimersByTimeAsync(2_999);
      await nextTick();
      expect(copyButton?.getAttribute("data-copy-state")).toBe("copied");

      await vi.advanceTimersByTimeAsync(1);
      await nextTick();
      expect(copyButton?.getAttribute("aria-label")).toBe("复制消息");
      expect(copyButton?.getAttribute("data-copy-state")).toBe("idle");
      expect(copyButton?.querySelector('[data-icon="copy"]')).not.toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps copy disabled for a message without text content", () => {
    const container = mountMessageList([
      {
        id: "user-image",
        sourceKey: "user-image",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [{ type: "image", data: "aGVsbG8=", mimeType: "image/png" }],
      },
    ]);

    expect(container.querySelector<HTMLButtonElement>("[data-slot=message-copy]")?.disabled).toBe(
      true,
    );
  });

  it("shows a persistent copy toolbar only on each completed agent loop final response", async () => {
    const writeText = vi.fn(async () => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const messages: Message[] = [
      {
        id: "user-1",
        sourceKey: "user-1",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: "第一轮" }],
      },
      {
        id: "assistant-1",
        sourceKey: "assistant-1",
        role: "assistant",
        timestamp: 2,
        status: "completed",
        content: [
          { type: "text", text: "调用前" },
          { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.ts" } },
          { type: "text", text: "# 第一轮最终回复" },
        ],
      },
      {
        id: "tool-1",
        sourceKey: "tool-1",
        role: "toolResult",
        timestamp: 3,
        status: "completed",
        content: [{ type: "text", text: "工具结果" }],
        toolCallId: "call-1",
        toolName: "read",
      },
      {
        id: "user-2",
        sourceKey: "user-2",
        role: "user",
        timestamp: 4,
        status: "completed",
        content: [{ type: "text", text: "第二轮" }],
      },
      {
        id: "assistant-2",
        sourceKey: "assistant-2",
        role: "assistant",
        timestamp: 5,
        status: "completed",
        content: [{ type: "text", text: "**第二轮最终回复**" }],
      },
    ];
    const { container, currentStreaming } = mountReactiveMessages(messages, true);
    await nextTick();

    let assistantMessages = container.querySelectorAll("[data-slot=assistant-message]");
    expect(assistantMessages).toHaveLength(3);
    expect(assistantMessages[0]?.querySelector("[data-slot=message-toolbar]")).toBeNull();
    expect(assistantMessages[1]?.querySelector("[data-slot=message-toolbar]")).not.toBeNull();
    expect(assistantMessages[2]?.querySelector("[data-slot=message-toolbar]")).toBeNull();

    currentStreaming.value = false;
    await nextTick();
    assistantMessages = container.querySelectorAll("[data-slot=assistant-message]");
    const toolbars = container.querySelectorAll(
      "[data-slot=assistant-message] [data-slot=message-toolbar]",
    );
    expect(toolbars).toHaveLength(2);
    expect(assistantMessages[2]?.querySelector("[data-slot=message-toolbar]")).not.toBeNull();
    expect(toolbars[0]?.getAttribute("data-visibility")).toBe("always");

    assistantMessages[1]?.querySelector<HTMLButtonElement>("[data-slot=message-copy]")?.click();
    await vi.waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("# 第一轮最终回复");
    });
  });

  it("does not show a copy toolbar when a completed loop ends with a tool", () => {
    const container = mountMessageList([
      {
        id: "user",
        sourceKey: "user",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: "检查文件" }],
      },
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 2,
        status: "completed",
        content: [
          { type: "text", text: "我来检查。" },
          { type: "toolCall", id: "call", name: "read", arguments: { path: "a.ts" } },
        ],
      },
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 3,
        status: "completed",
        content: [{ type: "text", text: "文件内容" }],
        toolCallId: "call",
        toolName: "read",
      },
    ]);

    expect(
      container.querySelector("[data-slot=assistant-message] [data-slot=message-toolbar]"),
    ).toBeNull();
  });

  it("shows the working indicator at the end only while the agent loop is active", () => {
    const message: Message = {
      id: "user",
      sourceKey: "user",
      role: "user",
      timestamp: 1,
      status: "completed",
      content: [{ type: "text", text: "开始处理" }],
    };
    const runningContainer = mountMessageList([message], true);
    const working = runningContainer.querySelector("[data-slot=message-list-working]");
    const messageList = runningContainer.querySelector("[data-slot=message-list]");

    expect(working?.getAttribute("role")).toBe("status");
    expect(working?.getAttribute("aria-label")).toBe("正在工作中");
    expect(working?.querySelector('[data-slot="loading"]')).not.toBeNull();
    expect(
      working
        ?.querySelector("[data-slot=message-list-working-label]")
        ?.classList.contains("shimmer"),
    ).toBe(true);
    expect(messageList?.lastElementChild).toBe(working);

    const completedContainer = mountMessageList([message]);
    expect(completedContainer.querySelector("[data-slot=message-list-working]")).toBeNull();
  });

  it("shows streaming thinking expanded and lets the user collapse it", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "streaming",
        content: [{ type: "thinking", thinking: "正在分析问题", status: "streaming" }],
      },
    ]);
    await nextTick();

    const thinkingBlock = container.querySelector("[data-slot=thinking-block]");
    const trigger = thinkingBlock?.querySelector("button");
    expect(trigger?.textContent).toContain("思考中");
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(thinkingBlock?.textContent).toContain("正在分析问题");
    await vi.waitFor(() => {
      expect(thinkingBlock?.querySelector(".comark-stream")).not.toBeNull();
    });

    const thinkingContent = thinkingBlock?.querySelector("[data-slot=thinking-content]");
    expect(thinkingContent?.classList.contains("max-h-[120px]")).toBe(true);
    expect(thinkingContent?.classList.contains("overflow-y-auto")).toBe(true);
    expect(thinkingContent?.classList.contains("overscroll-contain")).toBe(true);

    trigger?.click();
    await vi.waitFor(() => {
      expect(
        thinkingBlock?.querySelector("[data-slot=collapsible-content]")?.getAttribute("data-state"),
      ).toBe("closed");
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  it("shows completed thinking collapsed and lets the user expand redacted content", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [{ type: "thinking", thinking: "encrypted", redacted: true, status: "completed" }],
      },
    ]);
    await nextTick();

    const thinkingBlock = container.querySelector("[data-slot=thinking-block]");
    const trigger = thinkingBlock?.querySelector("button");
    expect(trigger?.textContent).toContain("思考已完成");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");

    trigger?.click();
    await vi.waitFor(() => {
      expect(
        thinkingBlock?.querySelector("[data-slot=collapsible-content]")?.getAttribute("data-state"),
      ).toBe("open");
    });

    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(thinkingBlock?.textContent).toContain("思考内容不可用。");
    expect(thinkingBlock?.querySelector("[data-slot=markdown-block]")).toBeNull();
    expect(thinkingBlock?.querySelector(".comark-stream")).toBeNull();
  });

  it("renders available thinking content with Comark markdown", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [
          {
            type: "thinking",
            thinking: "# 分析\n\n**重点**\n\n- 第一项\n- 第二项",
            status: "completed",
          },
        ],
      },
    ]);
    await nextTick();

    const thinkingBlock = container.querySelector("[data-slot=thinking-block]");
    thinkingBlock?.querySelector<HTMLButtonElement>("button")?.click();

    await vi.waitFor(() => {
      expect(thinkingBlock?.querySelector("h1")?.textContent).toBe("分析");
    });
    expect(thinkingBlock?.querySelector("strong")?.textContent).toBe("重点");
    expect(
      Array.from(thinkingBlock?.querySelectorAll("li") ?? [], (item) => item.textContent),
    ).toEqual(["第一项", "第二项"]);
    expect(thinkingBlock?.querySelector(".comark-stream")).toBeNull();
  });

  it("follows streaming thinking only while the user remains near the bottom", async () => {
    const streamingMessage: Message = {
      id: "assistant",
      sourceKey: "assistant",
      role: "assistant",
      timestamp: 1,
      status: "streaming",
      content: [{ type: "thinking", thinking: "第一段", status: "streaming" }],
    };
    const { container, currentMessage } = mountReactiveMessageList(streamingMessage);

    const thinkingContent = await vi.waitFor(() => {
      const element = container.querySelector<HTMLElement>("[data-slot=thinking-content]");
      expect(element).not.toBeNull();
      return element!;
    });
    let scrollHeight = 300;
    Object.defineProperties(thinkingContent, {
      clientHeight: { configurable: true, get: () => 120 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
    });

    thinkingContent.scrollTop = 180;
    thinkingContent.dispatchEvent(new Event("scroll"));
    scrollHeight = 360;
    currentMessage.value = {
      ...streamingMessage,
      content: [{ type: "thinking", thinking: "第一段\n\n第二段", status: "streaming" }],
    };
    await vi.waitFor(() => {
      expect(thinkingContent.scrollTop).toBe(360);
    });

    thinkingContent.scrollTop = 80;
    thinkingContent.dispatchEvent(new Event("scroll"));
    scrollHeight = 420;
    currentMessage.value = {
      ...streamingMessage,
      content: [{ type: "thinking", thinking: "第一段\n\n第二段\n\n第三段", status: "streaming" }],
    };
    await vi.waitFor(() => {
      expect(thinkingContent.textContent).toContain("第三段");
    });
    expect(thinkingContent.scrollTop).toBe(80);

    thinkingContent.scrollTop = 276;
    thinkingContent.dispatchEvent(new Event("scroll"));
    scrollHeight = 480;
    currentMessage.value = {
      ...streamingMessage,
      content: [
        {
          type: "thinking",
          thinking: "第一段\n\n第二段\n\n第三段\n\n第四段",
          status: "streaming",
        },
      ],
    };
    await vi.waitFor(() => {
      expect(thinkingContent.scrollTop).toBe(480);
    });
  });

  it("automatically collapses thinking when streaming completes", async () => {
    const streamingMessage: Message = {
      id: "assistant",
      sourceKey: "assistant",
      role: "assistant",
      timestamp: 1,
      status: "streaming",
      content: [{ type: "thinking", thinking: "即将完成", status: "streaming" }],
    };
    const { container, currentMessage } = mountReactiveMessageList(streamingMessage);
    await nextTick();

    const thinkingBlock = container.querySelector("[data-slot=thinking-block]");
    const trigger = thinkingBlock?.querySelector("button");
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(thinkingBlock?.textContent).toContain("即将完成");

    currentMessage.value = {
      ...streamingMessage,
      content: [{ type: "thinking", thinking: "即将完成", status: "completed" }],
    };
    await vi.waitFor(() => {
      expect(
        thinkingBlock?.querySelector("[data-slot=collapsible-content]")?.getAttribute("data-state"),
      ).toBe("closed");
    });

    expect(trigger?.textContent).toContain("思考已完成");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
  });

  it("renders all node types as safe, basic UI", async () => {
    const circularDetails: Record<string, unknown> = {};
    circularDetails.self = circularDetails;
    const messages: Message[] = [
      {
        id: "user",
        sourceKey: "user",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: "<script>window.hacked = true</script>" }],
      },
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 2,
        status: "streaming",
        content: [
          { type: "image", data: "aGVsbG8=", mimeType: "image/png" },
          { type: "thinking", thinking: "secret", redacted: true, status: "streaming" },
          { type: "toolCall", id: "call", name: "read", arguments: { path: "a.ts" } },
          { type: "unknown", nodeType: "future", value: { value: 1 } },
        ],
      },
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 3,
        status: "completed",
        content: [{ type: "text", text: "failed" }],
        toolCallId: "call",
        toolName: "read",
        isError: true,
        details: circularDetails,
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>window.hacked = true</script>");
    expect(container.querySelectorAll("[data-content-type]")).toHaveLength(5);
    expect(container.querySelectorAll("[data-slot=tool-message]")).toHaveLength(1);
    expect(container.querySelector("[data-slot=tool-call-block]")).toBeNull();
    expect(container.querySelector("[data-content-type=image]")?.getAttribute("src")).toBe(
      "data:image/png;base64,aGVsbG8=",
    );
    expect(container.textContent).toContain("思考内容不可用。");
    expect(container.textContent).toContain("读取 a.ts");
    expect(container.textContent).toContain("未知节点 · future");
    const toolTrigger = container.querySelector<HTMLButtonElement>(
      "[data-slot=tool-result-block] button",
    );
    toolTrigger?.click();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("[object Object]");
    });
  });

  it("dispatches each role to its own message component", async () => {
    const messages: Message[] = [
      {
        id: "user",
        sourceKey: "user",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: "hello" }],
      },
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 2,
        status: "streaming",
        content: [{ type: "text", text: "world" }],
      },
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 3,
        status: "completed",
        content: [{ type: "text", text: "result" }],
        toolName: "read",
        isError: true,
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    expect(container.querySelector("[data-slot=user-message]")?.textContent).toContain("hello");
    expect(container.querySelector("[data-slot=assistant-message]")?.textContent).toContain(
      "world",
    );
    expect(container.querySelector("[data-slot=tool-message]")?.textContent).toContain(
      "read 执行失败",
    );
    expect(
      container.querySelector("[data-message-role=assistant]")?.getAttribute("data-message-status"),
    ).toBe("streaming");
    expect(container.querySelector("[data-slot=tool-message] svg")?.className.baseVal).toContain(
      "text-destructive",
    );
  });

  it("renders default composer tokens in user message text", async () => {
    const skillSource =
      "[!test-global-skill](/Users/test/.willow/skills/test-global-skill/SKILL.md)";
    const fileSource = "[UserMessage.vue](apps/work/UserMessage.vue)";
    const boardSource =
      '<board-node path=".agents/panel/index.html" selector="#status" tag="section" label="Status">Project status</board-node>';
    const container = mountMessageList([
      {
        id: "user",
        sourceKey: "user",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [
          { type: "text", text: `查看 ${fileSource}、${boardSource} 并使用 ${skillSource}` },
        ],
      },
    ]);
    await nextTick();

    const userMessage = container.querySelector("[data-slot=user-message]");
    const fileToken = userMessage?.querySelector("[data-token-rule=vue-file]");
    const skillToken = userMessage?.querySelector("[data-token-rule=skill]");
    const boardToken = userMessage?.querySelector("[data-token-rule=board-node]");

    expect(fileToken?.textContent).toContain("UserMessage.vue");
    expect(fileToken?.getAttribute("data-token-source")).toBe(fileSource);
    expect(skillToken?.textContent).toContain("test-global-skill");
    expect(skillToken?.getAttribute("data-token-source")).toBe(skillSource);
    expect(boardToken?.textContent).toContain("Status");
    expect(boardToken?.getAttribute("data-token-source")).toBe(boardSource);
    expect(userMessage?.textContent).not.toContain("[!test-global-skill]");
  });

  it("renders markdown only for assistant text", async () => {
    const markdown = "# 标题\n\n**加粗**\n\n- 列表\n\n[链接](https://example.com)\n\n`code`";
    const messages: Message[] = [
      {
        id: "user",
        sourceKey: "user",
        role: "user",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: markdown }],
      },
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 2,
        status: "completed",
        content: [{ type: "text", text: markdown }],
      },
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 3,
        status: "completed",
        content: [{ type: "text", text: "**工具原文**" }],
      },
    ];
    const container = mountMessageList(messages);

    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=assistant-message] h1")?.textContent).toBe("标题");
    });

    const assistant = container.querySelector("[data-slot=assistant-message]");
    expect(assistant?.querySelector("strong")?.textContent).toBe("加粗");
    expect(assistant?.querySelector("li")?.textContent).toBe("列表");
    expect(assistant?.querySelector("a")?.getAttribute("href")).toBe("https://example.com");
    expect(assistant?.querySelector("code")?.textContent).toBe("code");
    expect(container.querySelector("[data-slot=user-message] h1")).toBeNull();
    expect(container.querySelector("[data-slot=user-message]")?.textContent).toContain("# 标题");
    expect(container.querySelector("[data-slot=tool-message] strong")).toBeNull();
    container.querySelector<HTMLButtonElement>("[data-slot=tool-result-block] button")?.click();
    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=tool-message]")?.textContent).toContain(
        "**工具原文**",
      );
    });
  });

  it("keeps object-like text literal while streaming markdown", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "streaming",
        content: [
          {
            type: "text",
            text: "调用函数 {workspaceId, relativePaths[]}",
          },
        ],
      },
    ]);

    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=markdown-block]")?.textContent).toContain(
        "调用函数 {workspaceId, relativePaths[]}",
      );
    });
  });

  it("collapses tool output and details behind the tool summary", async () => {
    const messages: Message[] = [
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: "const answer = 42;" }],
        toolName: "read",
        details: {
          msg: "读取 answer.ts 文件 1-1 行",
          kind: "read",
          path: "answer.ts",
          offset: 1,
          lineCount: 1,
        },
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    const trigger = container.querySelector<HTMLButtonElement>(
      "[data-slot=tool-result-block] button",
    );
    expect(trigger?.textContent).toContain("读取 answer.ts 文件 1-1 行");
    expect(trigger?.getAttribute("aria-label")).toContain("展开执行结果");
    expect(container.textContent).not.toContain("const answer = 42;");
    expect(container.textContent).not.toContain('"path": "answer.ts"');

    trigger?.click();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("const answer = 42;");
      expect(container.textContent).toContain('"path": "answer.ts"');
    });
    expect(trigger?.getAttribute("aria-label")).toContain("收起执行结果");
    expect(container.textContent).not.toContain('"msg"');

    trigger?.click();
    await vi.waitFor(() => {
      expect(container.textContent).not.toContain("const answer = 42;");
      expect(container.textContent).not.toContain('"path": "answer.ts"');
    });
  });

  it("shows shimmer while a web search is running", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "streaming",
        content: [
          {
            type: "toolCall",
            id: "search-call",
            name: "websearch",
            arguments: { query: "Willow 最新消息" },
          },
        ],
      },
    ]);
    await nextTick();

    const block = container.querySelector("[data-slot=websearch-result-block]");
    expect(block?.querySelector("[data-slot=tool-summary]")?.classList.contains("shimmer")).toBe(
      true,
    );
    expect(block?.textContent).not.toContain("搜索中…");
    expect(block?.querySelector("[data-slot=tool-status]")).toBeNull();
  });

  it("summarizes askUser calls and expands each recorded answer", async () => {
    const messages: Message[] = [
      {
        id: "assistant-ask",
        sourceKey: "assistant-ask",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [
          {
            type: "toolCall",
            id: "ask-call",
            name: "askUser",
            arguments: {
              questions: [
                {
                  header: "实现",
                  question: "选择实现方式？",
                  options: [
                    { label: "方案 A", description: "改动较小" },
                    { label: "方案 B", description: "扩展性更好" },
                  ],
                },
              ],
            },
          },
        ],
      },
      {
        id: "tool-ask",
        sourceKey: "tool-ask",
        role: "toolResult",
        timestamp: 2,
        status: "completed",
        content: [{ type: "text", text: "model-only answer" }],
        toolCallId: "ask-call",
        toolName: "askUser",
        details: {
          kind: "askUser",
          msg: "询问 1 个问题",
          questions: [
            {
              header: "实现",
              question: "选择实现方式？",
              options: [],
              answers: ["方案 A"],
            },
          ],
        },
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    const block = container.querySelector("[data-slot=ask-user-result-block]");
    const trigger = block?.querySelector<HTMLButtonElement>("button");
    expect(trigger?.textContent).toContain("询问 1 个问题");
    expect(container.textContent).not.toContain("选择实现方式？");

    trigger?.click();
    await vi.waitFor(() => expect(container.textContent).toContain("选择实现方式？"));
    expect(container.querySelector("[data-slot=ask-user-answer]")?.textContent).toContain("方案 A");
    expect(container.textContent).not.toContain("model-only answer");
  });

  it("renders a websearch summary and expands only structured result links", async () => {
    const messages: Message[] = [
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [
          {
            type: "toolCall",
            id: "search-call",
            name: "websearch",
            arguments: { query: "Willow 最新消息" },
          },
        ],
      },
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 2,
        status: "completed",
        content: [{ type: "text", text: "模型可见的搜索摘要" }],
        toolCallId: "search-call",
        toolName: "websearch",
        details: {
          msg: "搜索 Willow 最新消息",
          kind: "websearch",
          query: "Willow 最新消息",
          searchDepth: "basic",
          numResults: 5,
          resultCount: 2,
          hasAnswer: true,
          results: [
            {
              title: "Willow 发布新版本",
              url: "https://example.com/news",
              favicon: "https://example.com/favicon.ico",
            },
            {
              title: "不安全链接",
              url: "javascript:alert(1)",
              favicon: "http://example.com/favicon.ico",
            },
          ],
        },
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    const block = container.querySelector("[data-slot=websearch-result-block]");
    const trigger = block?.querySelector<HTMLButtonElement>("button");
    expect(trigger?.textContent).toContain("搜索 Willow 最新消息");
    expect(trigger?.textContent).not.toContain("搜索完成");
    expect(trigger?.textContent).not.toContain("搜索失败");
    expect(container.textContent).not.toContain("Willow 发布新版本");
    expect(container.textContent).not.toContain("模型可见的搜索摘要");

    trigger?.click();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("Willow 发布新版本");
    });
    expect(block?.querySelector("a")?.getAttribute("href")).toBe("https://example.com/news");
    expect(block?.querySelectorAll("a")).toHaveLength(1);
    expect(block?.querySelector("img")?.getAttribute("src")).toBe(
      "https://example.com/favicon.ico",
    );
    expect(container.textContent).not.toContain("模型可见的搜索摘要");
  });

  it("pairs a tool call with its result and keeps the call summary collapsed", async () => {
    const messages: Message[] = [
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [
          { type: "text", text: "调用前" },
          { type: "toolCall", id: "call-1", name: "read", arguments: { path: "answer.ts" } },
          { type: "text", text: "调用后" },
        ],
      },
      {
        id: "tool",
        sourceKey: "tool",
        role: "toolResult",
        timestamp: 2,
        status: "completed",
        content: [{ type: "text", text: "const answer = 42;" }],
        toolCallId: "call-1",
        toolName: "read",
        details: { msg: "读取完成", kind: "read", path: "answer.ts", offset: 1, lineCount: 1 },
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    const toolMessages = container.querySelectorAll("[data-slot=tool-message]");
    const assistantMessages = container.querySelectorAll("[data-slot=assistant-message]");
    const trigger = toolMessages[0]?.querySelector("button");
    expect(toolMessages).toHaveLength(1);
    expect(assistantMessages).toHaveLength(2);
    expect(assistantMessages[0]?.textContent).toContain("调用前");
    expect(assistantMessages[1]?.textContent).toContain("调用后");
    expect(trigger?.textContent).toContain("读取 answer.ts");
    expect(trigger?.textContent).not.toContain("读取完成");
    expect(toolMessages[0]?.textContent).not.toContain("const answer = 42;");

    trigger?.click();
    await vi.waitFor(() => {
      expect(toolMessages[0]?.textContent).toContain("const answer = 42;");
      expect(toolMessages[0]?.textContent).toContain('"lineCount": 1');
    });
  });

  it("shows a pending tool call immediately and preserves expansion when the result arrives", async () => {
    const assistant: Message = {
      id: "assistant",
      sourceKey: "assistant",
      role: "assistant",
      timestamp: 1,
      status: "streaming",
      content: [{ type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.ts" } }],
    };
    const result: Message = {
      id: "tool",
      sourceKey: "tool",
      role: "toolResult",
      timestamp: 2,
      status: "completed",
      content: [{ type: "text", text: "result text" }],
      toolCallId: "call-1",
      toolName: "read",
    };
    const { container, currentMessages } = mountReactiveMessages([assistant]);
    await nextTick();

    const trigger = container.querySelector<HTMLButtonElement>("[data-slot=tool-message] button");
    const summary = trigger?.querySelector("[data-slot=tool-summary]");
    expect(trigger?.textContent).toContain("读取 a.ts");
    expect(trigger?.getAttribute("aria-expanded")).toBe("false");
    expect(summary?.classList.contains("shimmer")).toBe(true);

    trigger?.click();
    await vi.waitFor(() => {
      expect(container.textContent).toContain("执行中…");
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");

    currentMessages.value = [assistant, result];
    await vi.waitFor(() => {
      expect(container.textContent).toContain("result text");
    });
    expect(trigger?.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).not.toContain("执行中…");
    expect(summary?.classList.contains("shimmer")).toBe(false);
  });

  it("renders multiple tool calls independently and keeps unmatched results visible", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [
          { type: "toolCall", id: "call-1", name: "read", arguments: { path: "a.ts" } },
          { type: "toolCall", id: "call-2", name: "read", arguments: { path: "b.ts" } },
        ],
      },
      {
        id: "tool-1",
        sourceKey: "tool-1",
        role: "toolResult",
        timestamp: 2,
        status: "completed",
        content: [{ type: "text", text: "a" }],
        toolCallId: "call-1",
        toolName: "read",
      },
      {
        id: "orphan",
        sourceKey: "orphan",
        role: "toolResult",
        timestamp: 3,
        status: "completed",
        content: [{ type: "text", text: "orphan result" }],
        toolCallId: "missing",
        toolName: "read",
      },
    ]);
    await nextTick();

    const toolMessages = container.querySelectorAll("[data-slot=tool-message]");
    expect(toolMessages).toHaveLength(3);
    expect(toolMessages[0]?.textContent).toContain("读取 a.ts");
    expect(toolMessages[1]?.textContent).toContain("读取 b.ts");
    expect(toolMessages[2]?.textContent).toContain("工具结果 · read");
  });

  it("renders math, Mermaid diagrams, and highlighted code blocks", async () => {
    const markdown = [
      "Inline formula $E = mc^2$.",
      "",
      "$$",
      "\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}",
      "$$",
      "",
      "```mermaid",
      "graph TD",
      "  A[Start] --> B[Done]",
      "```",
      "",
      "```typescript",
      "const answer: number = 42;",
      "```",
      "",
      "```markdown",
      "# Markdown source",
      "```",
      "",
      "```md",
      "**Markdown alias**",
      "```",
    ].join("\n");
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [{ type: "text", text: markdown }],
      },
    ]);

    await vi.waitFor(
      () => {
        expect(container.querySelector(".math.inline .katex")).not.toBeNull();
        expect(container.querySelector(".math.block .katex-display")).not.toBeNull();
        expect(container.querySelector(".mermaid svg")).not.toBeNull();
        expect(container.querySelectorAll("pre.shiki")).toHaveLength(3);
      },
      { timeout: 10_000 },
    );

    expect(container.querySelector(".mermaid style")?.textContent).not.toContain("@import");
    expect(container.querySelector(".mermaid")?.innerHTML).not.toContain("fonts.googleapis.com");
    const highlightedBlocks = [...container.querySelectorAll("pre.shiki")];
    expect(highlightedBlocks[0]?.textContent).toContain("const answer");
    expect(highlightedBlocks[1]?.textContent).toContain("# Markdown source");
    expect(highlightedBlocks[2]?.textContent).toContain("**Markdown alias**");
    expect(highlightedBlocks.every((block) => block.querySelector("span[style]"))).toBe(true);
  });

  it("keeps raw HTML inert in assistant markdown", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "completed",
        content: [
          {
            type: "text",
            text: '<script>window.hacked = true</script><img src="x" onerror="window.hacked=true">',
          },
        ],
      },
    ]);

    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=markdown-block]")?.textContent).toContain(
        "<script>window.hacked = true</script>",
      );
    });

    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[data-slot=markdown-block] img")).toBeNull();
    expect(container.querySelector("[onerror]")).toBeNull();
  });

  it("streams thinking while auto-closing only the last text node", async () => {
    const container = mountMessageList([
      {
        id: "assistant",
        sourceKey: "assistant",
        role: "assistant",
        timestamp: 1,
        status: "streaming",
        content: [
          { type: "text", text: "第一段" },
          { type: "thinking", thinking: "继续", status: "streaming" },
          { type: "text", text: "**未完成" },
        ],
      },
    ]);

    await vi.waitFor(() => {
      expect(
        container.querySelector("[data-slot=assistant-message] strong")?.textContent,
      ).toContain("未完成");
    });

    const textBlocks = container.querySelectorAll(
      "[data-content-type=text][data-slot=markdown-block]",
    );
    expect(textBlocks).toHaveLength(2);
    expect(textBlocks[0]?.querySelector('[style*="animation: pulse"]')).toBeNull();
    expect(textBlocks[1]?.querySelectorAll('[style*="animation: pulse"]')).toHaveLength(1);
    expect(
      container.querySelectorAll('[data-slot=thinking-block] [style*="animation: pulse"]'),
    ).toHaveLength(1);
  });
});
