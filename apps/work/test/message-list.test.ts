// @vitest-environment jsdom

import type { AgentMessage } from "@earendil-works/pi-agent-core";
import type { MessageStreamEvent } from "@shared/api";
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

const mountedApps: ReturnType<typeof createApp>[] = [];

function agentMessage(value: unknown): AgentMessage {
  return value as AgentMessage;
}

function streamEvent(value: unknown): MessageStreamEvent {
  return value as MessageStreamEvent;
}

function mountMessageList(messages: Message[]) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => h(MessageList, { messages }) });
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

  it("adds occurrence suffixes when source identities collide", () => {
    const duplicate = agentMessage({ role: "user", content: "same time", timestamp: 5 });
    const messages = toMessageList([duplicate, duplicate]);

    expect(messages.map((message) => message.id)).toEqual(["user:5::0", "user:5::1"]);
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
        toolName: "read",
        isError: true,
        details: circularDetails,
      },
    ];
    const container = mountMessageList(messages);
    await nextTick();

    expect(container.querySelector("script")).toBeNull();
    expect(container.textContent).toContain("<script>window.hacked = true</script>");
    expect(container.querySelectorAll("[data-content-type]")).toHaveLength(7);
    expect(container.querySelector("[data-content-type=image]")?.getAttribute("src")).toBe(
      "data:image/png;base64,aGVsbG8=",
    );
    expect(container.textContent).toContain("思考内容不可用。");
    expect(container.textContent).toContain("调用工具 · read");
    expect(container.textContent).toContain("未知节点 · future");
    expect(container.textContent).toContain("[object Object]");
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

    expect(container.querySelector("[data-slot=user-message]")?.textContent).toContain("你");
    expect(container.querySelector("[data-slot=assistant-message]")?.textContent).toContain("AI");
    expect(container.querySelector("[data-slot=tool-result]")?.textContent).toContain(
      "工具结果 · read失败",
    );
    expect(
      container.querySelector("[data-message-role=assistant]")?.getAttribute("data-message-status"),
    ).toBe("streaming");
    expect(container.querySelector("[data-slot=tool-result] > div")?.className).toContain(
      "border-destructive/40",
    );
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
    expect(container.querySelector("[data-slot=tool-result] strong")).toBeNull();
    expect(container.querySelector("[data-slot=tool-result]")?.textContent).toContain(
      "**工具原文**",
    );
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

  it("auto-closes only the last text node while an assistant message streams", async () => {
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

    const caretNodes = container.querySelectorAll('[style*="animation: pulse"]');
    expect(caretNodes).toHaveLength(1);
    expect(container.querySelectorAll("[data-slot=markdown-block]")).toHaveLength(2);
  });
});
