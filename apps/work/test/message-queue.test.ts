// @vitest-environment jsdom

import type { SendMessageRequest, StopMessageRequest } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createMessageQueueState } from "../src/renderer/src/composables/useMessageQueue";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function payload(content: string) {
  return {
    content,
    model: { providerId: "provider", modelId: "model" },
    approvalMode: "request-approval" as const,
    reasoningEffort: "high",
  };
}

function createQueue() {
  let nextId = 0;
  const send = vi.fn<(request: SendMessageRequest) => Promise<unknown>>();
  const stop = vi.fn<(request: StopMessageRequest) => Promise<{ stopped: boolean }>>();
  const queue = createMessageQueueState(
    { send, stop },
    {
      createId: () => `queue-${++nextId}`,
      now: () => 1_000 + nextId,
    },
  );
  return { queue, send, stop };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("message queue", () => {
  it("sends one message at a time in FIFO order", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const { queue, send } = createQueue();
    send.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);

    queue.enqueue({ workspaceId: 1, sessionId: "session", payload: payload("first") });
    const queued = queue.enqueue({
      workspaceId: 1,
      sessionId: "session",
      payload: payload("second"),
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].content).toBe("first");
    expect(queue.getQueuedMessages(1, "session")).toEqual([queued]);

    first.resolve(undefined);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][0].content).toBe("second");
    expect(queue.getQueuedMessages(1, "session")).toEqual([]);
    second.resolve(undefined);
  });

  it("preserves and deep-copies local file attachments", async () => {
    const pending = deferred<unknown>();
    const { queue, send } = createQueue();
    send.mockReturnValue(pending.promise);
    const attachment = { path: "/tmp/a.md", name: "a.md", fileType: "MD" };
    const input = { ...payload("review"), attachments: [attachment] };

    queue.enqueue({ workspaceId: 1, sessionId: "session", payload: input });
    attachment.name = "changed.md";

    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments: [{ path: "/tmp/a.md", name: "a.md", fileType: "MD" }],
      }),
    );
    pending.resolve(undefined);
  });

  it("runs different sessions independently", () => {
    const { queue, send } = createQueue();
    send.mockImplementation(() => new Promise(() => undefined));

    queue.enqueue({ workspaceId: 1, sessionId: "first", payload: payload("one") });
    queue.enqueue({ workspaceId: 1, sessionId: "second", payload: payload("two") });

    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls.map(([request]) => request.sessionId)).toEqual(["first", "second"]);
    expect(queue.isSessionActive(1, "first")).toBe(true);
    expect(queue.isSessionActive(1, "second")).toBe(true);
  });

  it("deletes only messages that are still queued", () => {
    const { queue, send } = createQueue();
    send.mockImplementation(() => new Promise(() => undefined));

    const active = queue.enqueue({
      workspaceId: 1,
      sessionId: "session",
      payload: payload("active"),
    });
    const removable = queue.enqueue({
      workspaceId: 1,
      sessionId: "session",
      payload: payload("remove"),
    });
    const retained = queue.enqueue({
      workspaceId: 1,
      sessionId: "session",
      payload: payload("retain"),
    });

    expect(queue.remove(1, "session", active.id)).toBe(false);
    expect(queue.remove(1, "session", removable.id)).toBe(true);
    expect(queue.getQueuedMessages(1, "session")).toEqual([retained]);
  });

  it("continues with the next message after a failed send and keeps the session error", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const second = deferred<unknown>();
    const { queue, send } = createQueue();
    send.mockRejectedValueOnce(new Error("provider failed")).mockReturnValueOnce(second.promise);

    queue.enqueue({ workspaceId: 1, sessionId: "session", payload: payload("first") });
    queue.enqueue({ workspaceId: 1, sessionId: "session", payload: payload("second") });

    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(send.mock.calls[1][0].content).toBe("second");
    expect(queue.getSessionError(1, "session")).toBe("provider failed");
    expect(queue.getSessionError(1, "other")).toBe("");
    second.resolve(undefined);
  });

  it("stops the current send and automatically continues the queue", async () => {
    const first = deferred<unknown>();
    const second = deferred<unknown>();
    const { queue, send, stop } = createQueue();
    send.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    stop.mockImplementation(async () => {
      first.resolve(undefined);
      return { stopped: true };
    });

    queue.enqueue({ workspaceId: 1, sessionId: "session", payload: payload("first") });
    queue.enqueue({ workspaceId: 1, sessionId: "session", payload: payload("second") });

    await expect(queue.stop(1, "session")).resolves.toBe(true);
    await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(2));
    expect(stop).toHaveBeenCalledWith({ workspaceId: 1, sessionId: "session" });
    expect(send.mock.calls[1][0].content).toBe("second");
    second.resolve(undefined);
  });

  it("keeps a blocked message queued until the session resumes", async () => {
    const running = deferred<unknown>();
    const { queue, send } = createQueue();
    send.mockReturnValue(running.promise);

    const queued = queue.enqueue({
      workspaceId: 1,
      sessionId: "session",
      payload: payload("after external task"),
      blocked: true,
    });

    expect(send).not.toHaveBeenCalled();
    expect(queue.getQueuedMessages(1, "session")).toEqual([queued]);

    queue.resume(1, "session");
    expect(send).toHaveBeenCalledOnce();
    running.resolve(undefined);
    await vi.waitFor(() => expect(queue.isSessionActive(1, "session")).toBe(false));
  });
});
