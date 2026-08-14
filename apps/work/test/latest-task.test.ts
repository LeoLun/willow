import { afterEach, describe, expect, it, vi } from "vitest";
import { createLatestTaskScheduler } from "../src/renderer/src/components/message-list/blocks/latest-task";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => (resolve = resolvePromise));
  return { promise, resolve };
}

afterEach(() => vi.useRealTimers());

describe("latest task scheduler", () => {
  it("keeps one running task and only the latest pending input", async () => {
    vi.useFakeTimers();
    const first = deferred<string>();
    const run = vi.fn((value: string) =>
      value === "first" ? first.promise : Promise.resolve(value),
    );
    const onResult = vi.fn();
    const scheduler = createLatestTaskScheduler({ delayMs: 200, run, onResult });

    scheduler.schedule("first", true);
    scheduler.schedule("stale");
    scheduler.schedule("latest");
    expect(run).toHaveBeenCalledTimes(1);
    first.resolve("first");
    await Promise.resolve();
    await Promise.resolve();
    vi.advanceTimersByTime(200);
    await Promise.resolve();

    expect(run).toHaveBeenLastCalledWith("latest");
    await Promise.resolve();
    expect(onResult).toHaveBeenCalledOnce();
    expect(onResult).toHaveBeenCalledWith("latest", "latest");
  });

  it("runs immediately on the first non-immediate schedule (no debounce starvation)", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async (value: string) => value);
    const onResult = vi.fn();
    const scheduler = createLatestTaskScheduler({ delayMs: 200, run, onResult });

    scheduler.schedule("first");
    await vi.advanceTimersByTimeAsync(0);

    expect(run).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenLastCalledWith("first");
    expect(onResult).toHaveBeenCalledWith("first", "first");
  });

  it("keeps running periodically while input arrives faster than delayMs", async () => {
    vi.useFakeTimers();
    const run = vi.fn(async (value: string) => value);
    const onResult = vi.fn();
    const scheduler = createLatestTaskScheduler({ delayMs: 200, run, onResult });

    // Streaming deltas arriving every 50ms — faster than the throttle interval.
    for (let index = 0; index < 10; index += 1) {
      scheduler.schedule(`chunk-${index}`);
      await vi.advanceTimersByTimeAsync(50);
    }
    await vi.advanceTimersByTimeAsync(200);

    // A pure debounce would starve until the stream pauses; throttling renders throughout.
    expect(run.mock.calls.length).toBeGreaterThanOrEqual(3);
    expect(onResult).toHaveBeenCalledWith("chunk-9", "chunk-9");
  });

  it("does not publish results after disposal", async () => {
    const task = deferred<string>();
    const onResult = vi.fn();
    const scheduler = createLatestTaskScheduler({ delayMs: 0, run: () => task.promise, onResult });
    scheduler.schedule("value", true);
    scheduler.dispose();
    task.resolve("value");
    await Promise.resolve();
    await Promise.resolve();
    expect(onResult).not.toHaveBeenCalled();
  });
});
