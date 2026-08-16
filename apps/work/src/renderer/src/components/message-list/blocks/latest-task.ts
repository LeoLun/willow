export interface LatestTaskScheduler<TInput> {
  dispose(): void;
  schedule(input: TInput, immediate?: boolean): void;
}

export interface LatestTaskSchedulerOptions<TInput, TOutput> {
  delayMs: number;
  run(input: TInput): Promise<TOutput>;
  onError?(error: unknown): void;
  onResult(result: TOutput, input: TInput): void;
}

interface PendingTask<TInput> {
  input: TInput;
  revision: number;
  immediate: boolean;
}

/**
 * Runs only the latest scheduled task while throttling how often it can start.
 *
 * Non-immediate scheduling throttles by `delayMs`: the first task runs right away and
 * subsequent tasks run at most once per `delayMs`, always using the newest input. This keeps
 * streaming markdown rendering periodically (unlike a pure debounce, which keeps pushing the
 * timer out and never runs while input keeps arriving faster than the delay).
 *
 * `immediate` scheduling bypasses the throttle and drains the newest input as soon as the
 * in-flight task settles, which is used for the final non-streaming render.
 */
export function createLatestTaskScheduler<TInput, TOutput>(
  options: LatestTaskSchedulerOptions<TInput, TOutput>,
): LatestTaskScheduler<TInput> {
  let disposed = false;
  let latestRevision = 0;
  let pending: PendingTask<TInput> | undefined;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastRunStartedAt = 0;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const scheduleDeferred = () => {
    clearTimer();
    const wait = Math.max(0, options.delayMs - (Date.now() - lastRunStartedAt));
    timer = setTimeout(() => void drain(), wait);
  };

  const schedulePending = () => {
    if (disposed || !pending) return;
    if (pending.immediate) void drain();
    else scheduleDeferred();
  };

  const drain = async (): Promise<void> => {
    clearTimer();
    if (disposed || running || !pending) return;
    const current = pending;
    pending = undefined;
    running = true;
    lastRunStartedAt = Date.now();
    try {
      const result = await options.run(current.input);
      if (!disposed && current.revision === latestRevision) {
        options.onResult(result, current.input);
      }
    } catch (error) {
      if (!disposed && current.revision === latestRevision) options.onError?.(error);
    } finally {
      running = false;
      schedulePending();
    }
  };

  return {
    schedule(input, immediate = false) {
      if (disposed) return;
      latestRevision += 1;
      pending = { input, revision: latestRevision, immediate };
      if (immediate) {
        void drain();
      } else if (!running) {
        scheduleDeferred();
      }
    },
    dispose() {
      disposed = true;
      latestRevision += 1;
      pending = undefined;
      clearTimer();
    },
  };
}
