// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick } from "vue";
import MessageList from "../src/renderer/src/components/message-list/MessageList.vue";
import type { Message } from "../src/renderer/src/components/message-list/types";

class ResizeObserverMock implements ResizeObserver {
  constructor(_callback: ResizeObserverCallback) {}
  disconnect(): void {}
  unobserve(): void {}
  observe(): void {}
}

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("virtual message list", () => {
  it("mounts only visible turns and overscan for a long conversation", async () => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    const viewport = document.createElement("div");
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 600 },
      scrollHeight: { configurable: true, value: 180_000 },
    });
    viewport.getBoundingClientRect = () =>
      ({ width: 800, height: 600, top: 0, left: 0, bottom: 600, right: 800 }) as DOMRect;
    const mountPoint = document.createElement("div");
    viewport.append(mountPoint);
    document.body.append(viewport);
    const messages: Message[] = Array.from({ length: 1_000 }, (_, index) => ({
      id: `user-${index}`,
      sourceKey: `user-${index}`,
      role: "user",
      timestamp: index,
      status: "completed",
      content: [{ type: "text", text: `message ${index}` }],
    }));

    const app = createApp({ render: () => h(MessageList, { messages, scrollElement: viewport }) });
    app.mount(mountPoint);
    await nextTick();
    await nextTick();

    expect(mountPoint.querySelector("[data-slot=virtual-message-list]")).not.toBeNull();
    const mountedTurns = mountPoint.querySelectorAll("[data-slot=message-turn]").length;
    expect(mountedTurns).toBeGreaterThan(0);
    expect(mountedTurns).toBeLessThan(20);
    app.unmount();
  });
});
