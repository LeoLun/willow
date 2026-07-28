// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h } from "vue";
import QueuedMessageList from "../src/renderer/src/components/prompt-composer/QueuedMessageList.vue";
import type { QueuedMessage } from "../src/renderer/src/composables/useMessageQueue";

const mountedApps: ReturnType<typeof createApp>[] = [];

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("QueuedMessageList", () => {
  it("renders queued content and emits the selected message id", () => {
    const messages: QueuedMessage[] = [
      {
        id: "first",
        workspaceId: 1,
        sessionId: "session",
        payload: {
          content: "第一条排队消息",
          model: { providerId: "provider", modelId: "model" },
        },
        createdAt: 1,
      },
      {
        id: "second",
        workspaceId: 1,
        sessionId: "session",
        payload: {
          content: "第二条排队消息",
          model: { providerId: "provider", modelId: "model" },
        },
        createdAt: 2,
      },
    ];
    const remove = vi.fn();
    const container = document.createElement("div");
    document.body.append(container);
    const app = createApp({
      setup: () => () => h(QueuedMessageList, { messages, onRemove: remove }),
    });
    app.mount(container);
    mountedApps.push(app);

    expect(container.textContent).toContain("排队中 · 2");
    expect(container.querySelectorAll("[data-slot=queued-message]")).toHaveLength(2);
    const button = container.querySelector<HTMLButtonElement>(
      "[aria-label='删除排队消息：第二条排队消息']",
    )!;
    button.click();
    expect(remove).toHaveBeenCalledWith("second");
  });
});
