import type { AgentEvent } from "@earendil-works/pi-agent-core";
import type { AssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MESSAGE_STREAM_FLUSH_INTERVAL_MS,
  MessageStreamEmitter,
} from "../src/main/service/message-stream-emitter";

const baseMessage: AssistantMessage = {
  role: "assistant",
  content: [{ type: "text", text: "" }],
  api: "openai-completions",
  provider: "openai",
  model: "model",
  stopReason: "stop",
  timestamp: 1,
  usage: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    totalTokens: 0,
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
  },
};

function update(delta: string, text: string): Extract<AgentEvent, { type: "message_update" }> {
  const message = { ...baseMessage, content: [{ type: "text" as const, text }] };
  return {
    type: "message_update",
    message,
    assistantMessageEvent: { type: "text_delta", contentIndex: 0, delta, partial: message },
  };
}

afterEach(() => vi.useRealTimers());

describe("MessageStreamEmitter", () => {
  it("coalesces deltas and flushes at most once per interval", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const stream = new MessageStreamEmitter("session", emit);
    stream.push(update("a", "a"));
    stream.push(update("b", "ab"));
    expect(emit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(MESSAGE_STREAM_FLUSH_INTERVAL_MS);
    expect(emit).toHaveBeenCalledOnce();
    expect(emit.mock.calls[0][0].event).toEqual({
      type: "update",
      messageTimestamp: 1,
      patches: [{ type: "text_delta", contentIndex: 0, delta: "ab" }],
    });
  });

  it("flushes pending updates before the final message and clears its timer", () => {
    vi.useFakeTimers();
    const emit = vi.fn();
    const stream = new MessageStreamEmitter("session", emit);
    stream.push(update("done", "done"));
    stream.push({
      type: "message_end",
      message: { ...baseMessage, content: [{ type: "text", text: "done" }] },
    });

    expect(emit.mock.calls.map(([payload]) => payload.event.type)).toEqual(["update", "end"]);
    vi.runAllTimers();
    expect(emit).toHaveBeenCalledTimes(2);
  });
});
