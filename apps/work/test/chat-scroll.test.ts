// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, shallowRef, type App } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import type { MessageTimeline } from "@/components/message-list";

const messageState = vi.hoisted(() => ({
  loading: undefined as unknown as ReturnType<typeof ref<boolean>>,
  timeline: undefined as unknown as ReturnType<
    typeof shallowRef<MessageTimeline>
  >,
}));

vi.mock("@/composables/useMessage", () => ({
  useSessionMessages: () => messageState,
}));

import Chat from "../src/renderer/src/pages/main/chat/Chat.vue";

const mountedApps: App[] = [];
const resizeCallbacks = new Map<Element, ResizeObserverCallback>();

class ResizeObserverMock implements ResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}

  disconnect(): void {
    for (const [element, callback] of resizeCallbacks) {
      if (callback === this.callback) resizeCallbacks.delete(element);
    }
  }

  observe(target: Element): void {
    resizeCallbacks.set(target, this.callback);
  }

  unobserve(target: Element): void {
    resizeCallbacks.delete(target);
  }
}

function triggerResize(target: Element, width?: number): void {
  const callback = resizeCallbacks.get(target);
  if (!callback) throw new Error("element is not observed");
  callback(
    width === undefined
      ? []
      : ([
          { contentRect: { width } } as ResizeObserverEntry,
        ] as ResizeObserverEntry[]),
    {} as ResizeObserver,
  );
}

async function flushResizeFrame(): Promise<void> {
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  await nextTick();
}

async function mountChat(): Promise<HTMLElement> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: "/chat/:sessionId", component: Chat }],
  });
  await router.push("/chat/session-a?workspaceId=1");
  await router.isReady();

  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h("div", [h("div", { "data-slot": "chat-toolbar-actions" }), h(Chat)]),
  });
  app.use(router);
  app.mount(container);
  mountedApps.push(app);
  await nextTick();
  return container;
}

beforeEach(() => {
  messageState.loading = ref(true);
  messageState.timeline = shallowRef<MessageTimeline>({ messages: [] });
  resizeCallbacks.clear();
  localStorage.clear();
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("Chat history scrolling", () => {
  it("owns the session usage action and responsive panel", async () => {
    const container = await mountChat();
    const layout = container.querySelector<HTMLElement>(
      "[data-slot=chat-layout]",
    );
    const toolbar = container.querySelector<HTMLElement>(
      "[data-slot=chat-toolbar-actions]",
    );
    const toggle = toolbar?.querySelector<HTMLButtonElement>(
      'button[aria-label="切换会话信息面板"]',
    );
    if (!layout || !toolbar || !toggle)
      throw new Error("session usage controls were not rendered");

    expect(toolbar.contains(toggle)).toBe(true);
    expect(
      container.querySelector("[data-slot=session-usage-sidebar]"),
    ).toBeNull();

    triggerResize(layout, 1_000);
    await flushResizeFrame();
    toggle.click();
    await nextTick();
    const panel = container.querySelector<HTMLElement>(
      "[data-slot=session-usage-sidebar]",
    );
    expect(layout.style.gridTemplateColumns).toBe("minmax(0, 1fr) 300px");
    expect(panel?.dataset.floating).toBe("false");
    expect(
      panel?.querySelector("[data-slot=session-usage-panel]"),
    ).not.toBeNull();
    expect(localStorage.getItem("willow:session-usage-panel-open")).toBe(
      "true",
    );

    triggerResize(layout, 819);
    expect(layout.style.gridTemplateColumns).toBe("minmax(0, 1fr) 300px");
    await flushResizeFrame();
    expect(layout.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    expect(
      container.querySelector("[data-slot=session-usage-sidebar]"),
    ).toBeNull();
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem("willow:session-usage-panel-open")).toBe(
      "true",
    );

    triggerResize(layout, 820);
    await flushResizeFrame();
    const restoredPanel = container.querySelector<HTMLElement>(
      "[data-slot=session-usage-sidebar]",
    );
    expect(layout.style.gridTemplateColumns).toBe("minmax(0, 1fr) 300px");
    expect(restoredPanel?.dataset.floating).toBe("false");

    toggle.click();
    await nextTick();
    expect(
      container.querySelector("[data-slot=session-usage-sidebar]"),
    ).toBeNull();
    expect(localStorage.getItem("willow:session-usage-panel-open")).toBe(
      "false",
    );

    triggerResize(layout, 819);
    await flushResizeFrame();
    toggle.click();
    await nextTick();
    const floatingPanel = container.querySelector<HTMLElement>(
      "[data-slot=session-usage-sidebar]",
    );
    expect(floatingPanel?.dataset.floating).toBe("true");
    expect(floatingPanel?.style.width).toBe("300px");
    expect(localStorage.getItem("willow:session-usage-panel-open")).toBe(
      "false",
    );

    triggerResize(layout, 820);
    await flushResizeFrame();
    expect(layout.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    expect(
      container.querySelector("[data-slot=session-usage-sidebar]"),
    ).toBeNull();
  });

  it("keeps the message list aligned with the composer when the chat pane narrows", async () => {
    const container = await mountChat();
    const content = container.querySelector<HTMLElement>(
      "[data-slot=chat-message-content]",
    );
    const composer = container.querySelector<HTMLElement>(
      "[data-slot=chat-composer]",
    );
    const composerContent = container.querySelector<HTMLElement>(
      "[data-slot=chat-composer-content]",
    );
    if (!content || !composer || !composerContent) {
      throw new Error("chat width containers were not rendered");
    }

    expect(content.classList).toContain("max-w-[50rem]");
    expect(content.classList).toContain("px-4");
    expect(
      container.querySelector("[data-slot=chat-messages]")?.classList,
    ).toContain("[scrollbar-gutter:stable_both-edges]");
    expect(composer.classList).not.toContain("px-4");
    expect(composerContent.classList).toContain("max-w-[50rem]");
    expect(composerContent.classList).toContain("px-4");
  });

  it("stays at the bottom when historical message content finishes laying out", async () => {
    const container = await mountChat();
    const viewport = container.querySelector<HTMLElement>(
      "[data-slot=chat-messages]",
    );
    const content = container.querySelector<HTMLElement>(
      "[data-slot=chat-message-content]",
    );
    const composer = container.querySelector<HTMLElement>(
      "[data-slot=chat-composer]",
    );
    const spacer = container.querySelector<HTMLElement>(
      "[data-slot=chat-bottom-spacer]",
    );
    if (!viewport || !content || !composer || !spacer) {
      throw new Error("chat viewport was not rendered");
    }

    let scrollHeight = 1_000;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, get: () => 500 },
      scrollHeight: { configurable: true, get: () => scrollHeight },
    });
    Object.defineProperty(composer, "offsetHeight", {
      configurable: true,
      get: () => 200,
    });
    triggerResize(composer);
    await nextTick();
    expect(spacer.style.height).toBe("232px");

    messageState.timeline.value = {
      messages: [
        {
          id: "assistant:1::0",
          sourceKey: "assistant:1:",
          role: "assistant",
          timestamp: 1,
          status: "completed",
          content: [{ type: "text", text: "历史消息" }],
        },
      ],
    };
    messageState.loading.value = false;
    await nextTick();
    await nextTick();
    expect(
      container.querySelector("[data-slot=message-toolbar]"),
    ).not.toBeNull();
    expect(content.lastElementChild).toBe(spacer);
    expect(viewport.scrollTop).toBe(1_000);

    scrollHeight = 1_400;
    viewport.dispatchEvent(new Event("scroll"));
    triggerResize(content);
    expect(viewport.scrollTop).toBe(1_400);

    viewport.scrollTop = 450;
    viewport.dispatchEvent(new Event("scroll"));
    scrollHeight = 1_600;
    triggerResize(content);
    expect(viewport.scrollTop).toBe(1_600);

    viewport.dispatchEvent(new WheelEvent("wheel", { deltaY: -40 }));
    viewport.scrollTop = 400;
    viewport.dispatchEvent(new Event("scroll"));
    scrollHeight = 1_800;
    triggerResize(content);
    expect(viewport.scrollTop).toBe(400);
  });
});
