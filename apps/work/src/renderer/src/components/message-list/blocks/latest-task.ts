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

export function createLatestTaskScheduler<TInput, TOutput>(
  options: LatestTaskSchedulerOptions<TInput, TOutput>,
): LatestTaskScheduler<TInput> {
  let disposed = false;
  let latestRevision = 0;
  let pending: { input: TInput; revision: number } | undefined;
  let running = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = undefined;
  };

  const drain = async (): Promise<void> => {
    clearTimer();
    if (disposed || running || !pending) return;
    const current = pending;
    pending = undefined;
    running = true;
    try {
      const result = await options.run(current.input);
      if (!disposed && current.revision === latestRevision) {
        options.onResult(result, current.input);
      }
    } catch (error) {
      if (!disposed && current.revision === latestRevision) options.onError?.(error);
    } finally {
      running = false;
      if (!disposed && pending && !timer) void drain();
    }
  };

  return {
    schedule(input, immediate = false) {
      if (disposed) return;
      latestRevision += 1;
      pending = { input, revision: latestRevision };
      clearTimer();
      if (immediate) {
        void drain();
      } else {
        timer = setTimeout(() => void drain(), options.delayMs);
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
