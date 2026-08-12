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
