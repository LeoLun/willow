import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import {
  type PendingChatMessage,
  usePendingChatStore,
} from "../src/renderer/src/stores/pending-chat.store";

const pendingMessage: PendingChatMessage = {
  sessionId: "session-1",
  workspaceId: 1,
  content: "Hello",
  model: { providerId: "openai", modelId: "large" },
};

describe("pending chat store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it("consumes a matching pending message only once", () => {
    const store = usePendingChatStore();
    store.stage(pendingMessage);

    expect(store.consume("session-1")).toEqual(pendingMessage);
    expect(store.consume("session-1")).toBeUndefined();
    expect(store.pendingMessage).toBeUndefined();
  });

  it("does not consume a pending message for another session", () => {
    const store = usePendingChatStore();
    store.stage(pendingMessage);

    expect(store.consume("session-2")).toBeUndefined();
    expect(store.pendingMessage).toEqual(pendingMessage);
  });

  it("clears only the requested pending session", () => {
    const store = usePendingChatStore();
    store.stage(pendingMessage);

    store.clear("session-2");
    expect(store.pendingMessage).toEqual(pendingMessage);

    store.clear("session-1");
    expect(store.pendingMessage).toBeUndefined();
  });
});
