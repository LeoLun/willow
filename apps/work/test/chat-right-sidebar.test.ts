// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getMessageList: vi.fn(),
  getProviderCatalog: vi.fn(),
  getSessionList: vi.fn(),
  getUserConfig: vi.fn(),
  openWorkspaceDirectory: vi.fn(),
  removeEventListener: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getConfiguredProviders: mocks.getConfiguredProviders,
    getMessageList: mocks.getMessageList,
    getProviderCatalog: mocks.getProviderCatalog,
    getSessionList: mocks.getSessionList,
    getUserConfig: mocks.getUserConfig,
    openWorkspaceDirectory: mocks.openWorkspaceDirectory,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

vi.mock("@/components/layout/BaseHeader.vue", () => ({
  default: defineComponent({
    setup(_, { slots }) {
      return () => h("header", [slots.left?.(), slots.right?.()]);
    },
  }),
}));

import ChatBase from "../src/renderer/src/pages/main/ChatBase.vue";

const mountedApps: App[] = [];
const resizeObservers: FakeResizeObserver[] = [];
let layoutWidth = 1000;

class FakeResizeObserver {
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }

  observe() {}

  unobserve() {}

  emit(width: number): void {
    layoutWidth = width;
    this.callback(
      [
        {
          contentRect: { width },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    );
  }
}

const ChatSlot = defineComponent({
  setup(_, { slots }) {
    return () => h("div", { "data-slot": "chat-test-slot" }, slots.default?.());
  },
});

async function mountChatBase(): Promise<HTMLElement> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/",
        component: ChatBase,
        children: [{ path: "chat/:sessionId", name: "chat", component: ChatSlot }],
      },
    ],
  });
  await router.push("/chat/session-a?workspaceId=1");
  await router.isReady();

  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => h(RouterView) });
  app.use(router);
  app.mount(container);
  mountedApps.push(app);
  await nextTick();
  return container;
}

function getToggle(container: HTMLElement): HTMLButtonElement {
  const toggle = container.querySelector<HTMLButtonElement>('button[aria-label="切换右侧边栏"]');
  if (!toggle) throw new Error("right sidebar toggle was not rendered");
  return toggle;
}

function getLayout(container: HTMLElement): HTMLElement {
  const layout = container.querySelector<HTMLElement>('[data-slot="chat-content-layout"]');
  if (!layout) throw new Error("chat content layout was not rendered");
  return layout;
}

function getHandle(container: HTMLElement): HTMLElement {
  const handle = container.querySelector<HTMLElement>(
    '[data-slot="chat-right-sidebar-resize-handle"]',
  );
  if (!handle) throw new Error("right sidebar resize handle was not rendered");
  return handle;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  layoutWidth = 1000;
  resizeObservers.splice(0);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const width = (this as HTMLElement).dataset.slot === "chat-content-layout" ? layoutWidth : 0;
    return {
      bottom: 0,
      height: 0,
      left: 0,
      right: width,
      top: 0,
      width,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    };
  });
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.getMessageList.mockResolvedValue({ messages: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getSessionList.mockResolvedValue({ sessions: [] });
  mocks.getUserConfig.mockResolvedValue({});
  mocks.openWorkspaceDirectory.mockResolvedValue({});
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  document.body.style.userSelect = "";
  vi.unstubAllGlobals();
});

describe("ChatBase right sidebar", () => {
  it("groups the workspace and sidebar actions", async () => {
    const container = await mountChatBase();
    const group = container.querySelector('[data-slot="button-group"]');
    const buttons = group?.querySelectorAll(':scope > [data-slot="button"]');

    expect(group).not.toBeNull();
    expect(buttons).toHaveLength(2);
    expect(buttons?.[0]?.getAttribute("aria-label")).toBe("打开当前工作空间");
    expect(buttons?.[1]).toBe(getToggle(container));

    (buttons?.[0] as HTMLButtonElement | undefined)?.click();
    await vi.waitFor(() => {
      expect(mocks.openWorkspaceDirectory).toHaveBeenCalledWith({ workspaceId: 1 });
    });
  });

  it("toggles the sidebar and restores its persisted open state", async () => {
    const container = await mountChatBase();
    const toggle = getToggle(container);

    expect(container.querySelector('[data-slot="chat-right-sidebar"]')).toBeNull();
    toggle.click();
    await nextTick();

    const layout = getLayout(container);
    const mainPane = container.querySelector('[data-slot="chat-main-pane"]');
    const rightSidebar = container.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]');
    expect(mainPane?.contains(toggle)).toBe(true);
    expect(rightSidebar?.parentElement).toBe(layout);
    expect(rightSidebar?.dataset.workspaceId).toBe("1");
    expect(layout.style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");
    expect(localStorage.getItem("willow:chat-right-sidebar-open")).toBe("true");

    mountedApps.pop()?.unmount();
    container.remove();
    const restoredContainer = await mountChatBase();
    expect(getToggle(restoredContainer).getAttribute("aria-expanded")).toBe("true");
    expect(restoredContainer.querySelector('[data-slot="chat-right-sidebar"]')).not.toBeNull();

    getToggle(restoredContainer).click();
    await nextTick();
    expect(restoredContainer.querySelector('[data-slot="chat-right-sidebar"]')).toBeNull();
    expect(localStorage.getItem("willow:chat-right-sidebar-open")).toBe("false");
  });

  it("keeps the main pane stable while the container width changes", async () => {
    localStorage.setItem("willow:chat-right-sidebar-open", "true");
    const container = await mountChatBase();
    const observer = resizeObservers.at(-1);
    if (!observer) throw new Error("content ResizeObserver was not registered");

    expect(getLayout(container).style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");
    observer.emit(1200);
    await nextTick();
    expect(getLayout(container).style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");
    expect(getHandle(container).getAttribute("aria-valuenow")).toBe("520");

    observer.emit(800);
    await nextTick();
    expect(getLayout(container).style.gridTemplateColumns).toBe("560px 8px minmax(0, 1fr)");

    observer.emit(1000);
    await nextTick();
    expect(getLayout(container).style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");
    expect(localStorage.getItem("willow:chat-right-sidebar-width")).toBeNull();
  });

  it("resizes from the pointer movement without snapping to the press position", async () => {
    localStorage.setItem("willow:chat-right-sidebar-open", "true");
    const container = await mountChatBase();
    const layout = getLayout(container);
    const handle = getHandle(container);

    expect(layout.style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");

    handle.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 679 }),
    );
    await nextTick();
    expect(layout.style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");

    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 678 }));
    await nextTick();
    expect(layout.style.gridTemplateColumns).toBe("671px 8px minmax(0, 1fr)");

    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(localStorage.getItem("willow:chat-right-sidebar-width")).toBe("321");
  });

  it("clamps and persists pointer and keyboard resizing", async () => {
    localStorage.setItem("willow:chat-right-sidebar-open", "true");
    const container = await mountChatBase();
    const handle = getHandle(container);

    handle.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 950 }),
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 1200 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    await nextTick();

    expect(getLayout(container).style.gridTemplateColumns).toBe("752px 8px minmax(0, 1fr)");
    expect(localStorage.getItem("willow:chat-right-sidebar-width")).toBe("240");

    getToggle(container).click();
    await nextTick();
    getToggle(container).click();
    await nextTick();
    expect(getLayout(container).style.gridTemplateColumns).toBe("752px 8px minmax(0, 1fr)");

    getHandle(container).dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "ArrowLeft" }),
    );
    await nextTick();
    expect(getLayout(container).style.gridTemplateColumns).toBe("736px 8px minmax(0, 1fr)");
    expect(localStorage.getItem("willow:chat-right-sidebar-width")).toBe("256");

    getHandle(container).dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 100 }),
    );
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: -200 }));
    window.dispatchEvent(new MouseEvent("pointerup"));
    await nextTick();
    expect(getLayout(container).style.gridTemplateColumns).toBe("500px 8px minmax(0, 1fr)");
  });

  it("cleans up resize resources when unmounted during a drag", async () => {
    localStorage.setItem("willow:chat-right-sidebar-open", "true");
    const container = await mountChatBase();
    const observer = resizeObservers.at(-1);
    if (!observer) throw new Error("content ResizeObserver was not registered");

    getHandle(container).dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 700 }),
    );
    expect(document.body.style.userSelect).toBe("none");

    mountedApps.pop()?.unmount();
    expect(observer.disconnect).toHaveBeenCalledOnce();
    expect(document.body.style.userSelect).toBe("");
  });
});
