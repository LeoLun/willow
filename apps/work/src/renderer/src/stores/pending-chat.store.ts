import type { ModelConfig } from "@shared/api";
import { acceptHMRUpdate, defineStore } from "pinia";
import { shallowRef } from "vue";

export interface PendingChatMessage {
  sessionId: string;
  workspaceId: number;
  content: string;
  model: ModelConfig;
}

export const usePendingChatStore = defineStore("pending-chat", () => {
  const pendingMessage = shallowRef<PendingChatMessage>();

  function stage(message: PendingChatMessage) {
    pendingMessage.value = message;
  }

  function consume(sessionId: string): PendingChatMessage | undefined {
    if (pendingMessage.value?.sessionId !== sessionId) return undefined;

    const message = pendingMessage.value;
    pendingMessage.value = undefined;
    return message;
  }

  function clear(sessionId?: string) {
    if (sessionId === undefined || pendingMessage.value?.sessionId === sessionId) {
      pendingMessage.value = undefined;
    }
  }

  return { pendingMessage, stage, consume, clear };
});

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(usePendingChatStore, import.meta.hot));
}
