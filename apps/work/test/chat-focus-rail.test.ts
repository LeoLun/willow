// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, shallowRef, type App } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import type { Message, MessageTimeline } from "@/components/message-list";

const messageState = vi.hoisted(() => ({
  loading: undefined as unknown as ReturnType<typeof ref<boolean>>,
  timeline: undefined as unknown as ReturnType<typeof shallowRef<MessageTimeline>>,
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

function triggerResize(target: Element): void {
  const callback = resizeCallbacks.get(target);
  if (!callback) throw new Error("element is not observed");
  callback([], {} as ResizeObserver);
}

class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  private elements = new Set<Element>();

  private callback: IntersectionObserverCallback;

  root: Element | Document | null;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.root = options?.root ?? null;
    MockIntersectionObserver.instances.push(this);
  }

  observe(el: Element): void {
    this.elements.add(el);
  }

  unobserve(el: Element): void {
    this.elements.delete(el);
  }

  disconnect(): void {
    this.elements.clear();
  }

  observedIds(): string[] {
    return [...this.elements].map((el) => el.id).sort();
  }
}

function stubScrollIntoView() {
  const scrollIntoView = vi.fn();
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollIntoView");
  (Element.prototype as unknown as Record<string, unknown>).scrollIntoView = scrollIntoView;
  afterEach(() => {
    if (descriptor) {
      Object.defineProperty(Element.prototype, "scrollIntoView", descriptor);
    } else {
      delete (Element.prototype as unknown as Record<string, unknown>).scrollIntoView;
    }
  });
  return scrollIntoView;
}

function stubElementScrollTo() {
  const scrollTo = vi.fn(function (this: HTMLElement, options?: ScrollToOptions) {
    if (options && typeof options.top === "number") this.scrollTop = options.top;
    this.dispatchEvent(new Event("scroll"));
  });
  const descriptor = Object.getOwnPropertyDescriptor(Element.prototype, "scrollTo");
  (Element.prototype as unknown as Record<string, unknown>).scrollTo = scrollTo;
  afterEach(() => {
    if (descriptor) {
      Object.defineProperty(Element.prototype, "scrollTo", descriptor);
    } else {
      delete (Element.prototype as unknown as Record<string, unknown>).scrollTo;
    }
  });
  return scrollTo;
}

function userMessage(index: number): Message {
  return {
    id: `user:${index}`,
    sourceKey: `user:${index}`,
    role: "user",
    timestamp: index,
    status: "completed",
    content: [{ type: "text", text: `问题 ${index}` }],
  };
}

function assistantMessage(index: number, text = `AI 回复 ${index}`): Message {
  return {
    id: `assistant:${index}`,
    sourceKey: `assistant:${index}`,
    role: "assistant",
    timestamp: index + 0.5,
    status: "completed",
    content: [{ type: "text", text }],
  };
}

function rect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    ...overrides,
    toJSON: () => ({}),
  } as DOMRect;
}

function railButtons(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("[data-rail-id]")];
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
  const app = createApp({ render: () => h(Chat) });
  app.use(router);
  app.mount(container);
  mountedApps.push(app);
  await nextTick();
  return container;
}

async function setMessages(messages: Message[]): Promise<void> {
  messageState.timeline.value = { messages };
  messageState.loading.value = false;
  await nextTick();
  await nextTick();
}

beforeEach(() => {
  messageState.loading = ref(true);
  messageState.timeline = shallowRef<MessageTimeline>({ messages: [] });
  resizeCallbacks.clear();
  MockIntersectionObserver.instances.length = 0;
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("Chat Focus Rail 展示条件", () => {
  it("用户消息不超过 3 条时不渲染 Rail", async () => {
    const container = await mountChat();
    await setMessages([userMessage(0), userMessage(1), userMessage(2)]);

    expect(container.querySelector("[data-slot=focus-rail]")).toBeNull();
  });

  it("用户消息 4 条时渲染 Rail，item 数与用户消息一一对应", async () => {
    const container = await mountChat();
    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);

    expect(container.querySelector("[data-slot=focus-rail]")).not.toBeNull();
    expect(railButtons(container)).toHaveLength(4);
    expect(railButtons(container)[0].getAttribute("aria-label")).toBe("问题 0");
    expect(railButtons(container)[3].getAttribute("aria-label")).toBe("问题 3");
  });

  it("消息列表宽度不足时隐藏 Rail，宽度恢复后自动显示", async () => {
    const container = await mountChat();
    const viewport = container.querySelector<HTMLElement>("[data-slot=chat-messages]")!;
    const content = container.querySelector<HTMLElement>("[data-slot=chat-message-content]")!;
    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);

    expect(container.querySelector("[data-slot=focus-rail]")).not.toBeNull();

    viewport.getBoundingClientRect = () => rect({ left: 0, width: 640 });
    content.getBoundingClientRect = () => rect({ left: 16, width: 608 });
    triggerResize(content);
    await nextTick();
    expect(container.querySelector("[data-slot=focus-rail]")).toBeNull();

    viewport.getBoundingClientRect = () => rect({ left: 0, width: 1_000 });
    content.getBoundingClientRect = () => rect({ left: 100, width: 800 });
    triggerResize(content);
    await nextTick();
    expect(container.querySelector("[data-slot=focus-rail]")).not.toBeNull();
  });

  it("用户消息文章元素带 Rail 定位锚点 id", async () => {
    await mountChat();
    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);

    expect(document.getElementById("user-message-user:0")).not.toBeNull();
    expect(document.getElementById("user-message-user:3")).not.toBeNull();
  });
});

describe("Chat Focus Rail 交互", () => {
  it("hover item 以固定高度展示单行用户标题和对应 AI 文字", async () => {
    const container = await mountChat();
    await setMessages([
      userMessage(0),
      assistantMessage(0),
      userMessage(1),
      assistantMessage(1, "已完成两阶段内存优化，未修改数据库结构。"),
      userMessage(2),
      assistantMessage(2),
      userMessage(3),
      assistantMessage(3),
    ]);

    railButtons(container)[1].dispatchEvent(new FocusEvent("focus"));

    await vi.waitFor(() => {
      expect(document.body.querySelector("[data-slot=hover-card-content]")).not.toBeNull();
    });

    const content = document.body.querySelector("[data-slot=hover-card-content]")!;
    expect(content.textContent).toContain("问题 1");
    expect(content.textContent).toContain("已完成两阶段内存优化，未修改数据库结构。");
    expect(content.classList.contains("h-28")).toBe(true);
    expect(content.querySelector("p")?.classList.contains("truncate")).toBe(true);
    expect(content.querySelectorAll("p")[1].classList.contains("line-clamp-3")).toBe(true);
  });

  it("hover item 时横线按距离逐步变短", async () => {
    const container = await mountChat();
    await setMessages([
      userMessage(0),
      userMessage(1),
      userMessage(2),
      userMessage(3),
      userMessage(4),
    ]);

    railButtons(container)[2].dispatchEvent(new FocusEvent("focus"));
    await vi.waitFor(() => {
      expect(document.body.querySelector("[data-slot=hover-card-content]")).not.toBeNull();
    });

    const lines = [...container.querySelectorAll<HTMLElement>("[data-slot=focus-rail-line]")];
    expect(lines.map((line) => [...line.classList].find((name) => /^w-\d+$/.test(name)))).toEqual([
      "w-5",
      "w-7",
      "w-10",
      "w-7",
      "w-5",
    ]);
  });

  it("点击 item 滚动定位到对应消息，且定位后不再吸底", async () => {
    const scrollIntoView = stubScrollIntoView();
    const container = await mountChat();
    const viewport = container.querySelector<HTMLElement>("[data-slot=chat-messages]")!;
    Object.defineProperty(viewport, "scrollHeight", { configurable: true, get: () => 1_000 });
    Object.defineProperty(viewport, "clientHeight", { configurable: true, get: () => 500 });
    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);

    viewport.scrollTop = 500;
    railButtons(container)[1].click();
    await nextTick();

    const target = document.getElementById("user-message-user:1")!;
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(scrollIntoView.mock.instances[0]).toBe(target);

    // 定位后新增消息不应把视口拉回底部
    await setMessages([
      userMessage(0),
      userMessage(1),
      userMessage(2),
      userMessage(3),
      userMessage(4),
    ]);
    expect(viewport.scrollTop).toBe(500);
  });

  it("虚拟化长会话中点击早期 item 先按 turn 滚动再精确居中", async () => {
    const scrollIntoView = stubScrollIntoView();
    const scrollTo = stubElementScrollTo();
    const container = await mountChat();
    const viewport = container.querySelector<HTMLElement>("[data-slot=chat-messages]")!;
    Object.defineProperties(viewport, {
      clientHeight: { configurable: true, value: 600 },
      clientWidth: { configurable: true, value: 800 },
      scrollHeight: { configurable: true, value: 100_000 },
    });
    viewport.getBoundingClientRect = () => rect({ width: 800, height: 600 });

    const messages = Array.from({ length: 60 }, (_, index) => userMessage(index));
    await setMessages(messages);

    expect(container.querySelector("[data-slot=virtual-message-list]")).not.toBeNull();

    railButtons(container)[59].click();
    await nextTick();
    await nextTick();
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });

    expect(scrollTo).toHaveBeenCalled();
    const target = document.getElementById("user-message-user:59");
    expect(target).not.toBeNull();
    expect(scrollIntoView.mock.instances.at(-1)).toBe(target);
  });
});

describe("Chat Focus Rail 定位与遮挡", () => {
  it("IntersectionObserver 以滚动容器为根并观察已挂载的用户消息", async () => {
    const container = await mountChat();
    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);

    const viewport = container.querySelector("[data-slot=chat-messages]")!;
    expect(MockIntersectionObserver.instances).toHaveLength(1);
    expect(MockIntersectionObserver.instances[0].root).toBe(viewport);
    expect(MockIntersectionObserver.instances[0].observedIds()).toEqual([
      "user-message-user:0",
      "user-message-user:1",
      "user-message-user:2",
      "user-message-user:3",
    ]);
  });

  it("窄面板时隐藏 Rail，消息列与输入框保持正常内边距", async () => {
    const container = await mountChat();
    const content = container.querySelector<HTMLElement>("[data-slot=chat-message-content]")!;
    const composerContent = container.querySelector<HTMLElement>(
      "[data-slot=chat-composer-content]",
    )!;
    const viewport = container.querySelector<HTMLElement>("[data-slot=chat-messages]")!;
    viewport.getBoundingClientRect = () => rect({ left: 0, width: 500 });
    content.getBoundingClientRect = () => rect({ left: 0, width: 500 });

    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);
    triggerResize(content);
    await nextTick();

    expect(container.querySelector("[data-slot=focus-rail]")).toBeNull();
    expect(content.classList.contains("px-4")).toBe(true);
    expect(content.classList.contains("pl-[88px]")).toBe(false);
    expect(composerContent.classList.contains("px-4")).toBe(true);
    expect(composerContent.classList.contains("pl-[88px]")).toBe(false);
  });

  it("宽面板且有自然边距时不加 gutter，保持 px-4", async () => {
    const container = await mountChat();
    const content = container.querySelector<HTMLElement>("[data-slot=chat-message-content]")!;
    const viewport = container.querySelector<HTMLElement>("[data-slot=chat-messages]")!;
    viewport.getBoundingClientRect = () => rect({ left: 0, width: 1_200 });
    content.getBoundingClientRect = () => rect({ left: 200, width: 800 });

    await setMessages([userMessage(0), userMessage(1), userMessage(2), userMessage(3)]);
    triggerResize(content);
    await nextTick();

    expect(container.querySelector("[data-slot=focus-rail]")).not.toBeNull();
    expect(content.classList.contains("px-4")).toBe(true);
    expect(content.classList.contains("pl-[88px]")).toBe(false);
  });
});
