import { ref, onUnmounted, getCurrentInstance, type Ref } from "vue";
import { getClient } from "@/api/client";
import type { Event } from "@opencode-ai/sdk/v2/client";

/**
 * SSE 事件监听器类型
 */
export type EventListener<T extends Event = Event> = (event: T) => void;

/**
 * SSE 连接状态
 */
export type ConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

/**
 * useOpencodeEvents composable
 *
 * 参照 OpenCode SDK 文档（https://opencode.ai/docs/zh-cn/sdk/）的 SSE 事件订阅模式：
 *
 * ```ts
 * const events = await client.event.subscribe()
 * for await (const event of events.stream) {
 *   console.log("Event:", event.type, event.properties)
 * }
 * ```
 *
 * 提供：
 * - 按事件类型注册监听器（支持通配符 "*"）
 * - 自动重连（指数退避 + 抖动）
 * - 响应式连接状态
 * - 组件卸载时自动清理
 */
export function useOpencodeEvents(options?: {
  /** 自动连接（默认 false，需手动调用 connect） */
  autoConnect?: boolean;
  /** 最大重试次数（默认 Infinity） */
  maxRetries?: number;
  /** 初始重试延迟 ms（默认 1000） */
  retryDelay?: number;
  /** 最大重试延迟 ms（默认 30000） */
  maxRetryDelay?: number;
  /** directory 参数（传给 SSE 订阅的 query.directory） */
  directory?: string;
}) {
  const {
    autoConnect = false,
    maxRetries = Infinity,
    retryDelay = 1000,
    maxRetryDelay = 30000,
    directory,
  } = options ?? {};

  const status: Ref<ConnectionStatus> = ref("disconnected");
  const retryCount = ref(0);

  // 事件监听器注册表
  const listeners = new Map<string, Set<EventListener<any>>>();
  // 通配符监听器（接收所有事件）
  const wildcardListeners = new Set<EventListener<Event>>();

  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let isDestroyed = false;
  let shouldStop = false;

  /**
   * 注册事件监听器
   *
   * @param type 事件类型，传 "*" 监听所有事件
   * @param listener 回调函数
   * @returns 取消监听的函数
   */
  function on<T extends Event>(
    type: T["type"] | "*",
    listener: EventListener<T>,
  ): () => void {
    if (type === "*") {
      wildcardListeners.add(listener as EventListener<Event>);
      return () => wildcardListeners.delete(listener as EventListener<Event>);
    }

    if (!listeners.has(type)) {
      listeners.set(type, new Set());
    }
    listeners.get(type)!.add(listener);
    return () => listeners.get(type)?.delete(listener);
  }

  /**
   * 分发事件到已注册的监听器
   */
  function dispatch(event: Event) {
    // 类型匹配的监听器
    const typeListeners = listeners.get(event.type);
    if (typeListeners) {
      for (const listener of typeListeners) {
        try {
          listener(event);
        } catch (err) {
          console.error(
            `[useOpencodeEvents] Error in listener for "${event.type}":`,
            err,
          );
        }
      }
    }

    // 通配符监听器
    for (const listener of wildcardListeners) {
      try {
        listener(event);
      } catch (err) {
        console.error("[useOpencodeEvents] Error in wildcard listener:", err);
      }
    }
  }

  /**
   * 计算重试延迟（指数退避 + 抖动）
   */
  function getRetryDelay(): number {
    const exponential = retryDelay * Math.pow(2, retryCount.value);
    const jitter = Math.random() * retryDelay * 0.5;
    return Math.min(exponential + jitter, maxRetryDelay);
  }

  /**
   * 启动 SSE 连接
   *
   * 遵循 SDK 文档的标准模式：
   * const events = await client.event.subscribe()
   * for await (const event of events.stream) { ... }
   */
  async function connect() {
    if (isDestroyed) return;
    if (status.value === "connecting" || status.value === "connected") return;

    status.value = "connecting";
    shouldStop = false;

    try {
      const client = getClient();

      // SDK 文档：const events = await client.event.subscribe()
      const events = await client.event.subscribe(
        directory ? { directory } : undefined,
      );

      status.value = "connected";
      retryCount.value = 0;

      console.log(
        "[useOpencodeEvents] SSE connected",
        directory ? `(directory: ${directory})` : "",
      );

      // SDK 文档：for await (const event of events.stream)
      for await (const event of events.stream) {
        if (isDestroyed || shouldStop) break;
        dispatch(event as Event);
      }

      // 流正常结束，尝试重连
      if (!isDestroyed && !shouldStop) {
        console.log("[useOpencodeEvents] Stream ended, scheduling reconnect");
        scheduleRetry();
      }
    } catch (err) {
      if (isDestroyed || shouldStop) return;

      console.error("[useOpencodeEvents] Connection error:", err);
      status.value = "error";
      scheduleRetry();
    }
  }

  /**
   * 安排重连
   */
  function scheduleRetry() {
    if (isDestroyed) return;
    if (retryCount.value >= maxRetries) {
      status.value = "error";
      console.warn("[useOpencodeEvents] Max retries reached, giving up.");
      return;
    }

    status.value = "disconnected";
    const delay = getRetryDelay();
    retryCount.value++;

    console.log(
      `[useOpencodeEvents] Reconnecting in ${Math.round(delay)}ms (attempt ${retryCount.value})`,
    );

    retryTimer = setTimeout(() => {
      retryTimer = null;
      connect();
    }, delay);
  }

  /**
   * 断开连接
   */
  function disconnect() {
    shouldStop = true;

    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }

    status.value = "disconnected";
    retryCount.value = 0;
  }

  /**
   * 销毁（组件卸载时自动调用）
   */
  function destroy() {
    isDestroyed = true;
    disconnect();
    listeners.clear();
    wildcardListeners.clear();
  }

  // 自动连接
  if (autoConnect) {
    connect();
  }

  // 组件卸载时自动清理（仅在 setup 上下文中注册）
  if (getCurrentInstance()) {
    onUnmounted(destroy);
  }

  return {
    /** 连接状态 */
    status,
    /** 重试次数 */
    retryCount,
    /** 注册事件监听器 */
    on,
    /** 启动连接 */
    connect,
    /** 断开连接 */
    disconnect,
  };
}
