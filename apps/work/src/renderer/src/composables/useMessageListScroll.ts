export interface MessageTurnScrollOptions {
  align?: "start" | "center" | "end" | "auto";
  behavior?: "auto" | "smooth";
}

export interface MessageListScrollHandle {
  scrollToTurn(index: number, options?: MessageTurnScrollOptions): void;
}

let activeHandle: MessageListScrollHandle | undefined;

/**
 * 消息列表虚拟滚动句柄注册表。
 *
 * MessageList 在启用虚拟化时注册自身的 virtualizer，页面级组件（如 ChatFocusRail）
 * 通过 scrollToTurn 按 turn 下标定位消息，无需感知 virtualizer 内部实现。
 */
export function useMessageListScroll() {
  function register(handle: MessageListScrollHandle): () => void {
    activeHandle = handle;
    return () => {
      if (activeHandle === handle) activeHandle = undefined;
    };
  }

  function scrollToTurn(index: number, options?: MessageTurnScrollOptions): boolean {
    if (!activeHandle) return false;
    activeHandle.scrollToTurn(index, options);
    return true;
  }

  return { register, scrollToTurn };
}
