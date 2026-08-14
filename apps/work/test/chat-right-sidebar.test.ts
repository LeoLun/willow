// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView, type Router } from "vue-router";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getBoardPanel: vi.fn(),
  getMessageList: vi.fn(),
  getProviderCatalog: vi.fn(),
  getSessionList: vi.fn(),
  getSkillList: vi.fn(),
  getUserConfig: vi.fn(),
  listWorkspaceDirectory: vi.fn(),
  openWorkspaceDirectory: vi.fn(),
  readPlanFile: vi.fn(),
  readWorkspaceFile: vi.fn(),
  removeEventListener: vi.fn(),
  searchFiles: vi.fn(),
  subscribeWorkspaceFiles: vi.fn(),
  unsubscribeWorkspaceFiles: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getConfiguredProviders: mocks.getConfiguredProviders,
    getBoardPanel: mocks.getBoardPanel,
    getMessageList: mocks.getMessageList,
    getProviderCatalog: mocks.getProviderCatalog,
    getSessionList: mocks.getSessionList,
    getSkillList: mocks.getSkillList,
    getUserConfig: mocks.getUserConfig,
    listWorkspaceDirectory: mocks.listWorkspaceDirectory,
    openWorkspaceDirectory: mocks.openWorkspaceDirectory,
    readPlanFile: mocks.readPlanFile,
    readWorkspaceFile: mocks.readWorkspaceFile,
    searchFiles: mocks.searchFiles,
    subscribeWorkspaceFiles: mocks.subscribeWorkspaceFiles,
    unsubscribeWorkspaceFiles: mocks.unsubscribeWorkspaceFiles,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

vi.mock("../src/renderer/src/components/right-sidebar/MonacoCodeViewer.vue", async () => {
  const { defineComponent: defineVueComponent, h: renderElement } = await import("vue");
  return {
    default: defineVueComponent({
      props: {
        code: { required: true, type: String },
        language: { required: true, type: String },
      },
      setup(props) {
        return () =>
          renderElement("div", {
            "data-code": props.code,
            "data-language": props.language,
            "data-slot": "monaco-code-viewer",
          });
      },
    }),
  };
});

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
let mountedRouter: Router | undefined;

const rightSidebarOpenStorageKey = (scope: string) => `willow:chat-right-sidebar-open:${scope}`;

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

async function mountChatBase(path = "/chat/session-a?workspaceId=1"): Promise<HTMLElement> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: "/",
        component: ChatBase,
        children: [
          { path: "", name: "home", component: ChatSlot },
          { path: "chat/:sessionId", name: "chat", component: ChatSlot },
        ],
      },
    ],
  });
  mountedRouter = router;
  await router.push(path);
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
  mocks.getBoardPanel.mockResolvedValue({ status: "missing" });
  mocks.getMessageList.mockResolvedValue({ messages: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getSessionList.mockResolvedValue({ sessions: [] });
  mocks.getSkillList.mockResolvedValue({ skills: [] });
  mocks.getUserConfig.mockResolvedValue({});
  mocks.listWorkspaceDirectory.mockResolvedValue({
    entries: [{ name: "package.json", relativePath: "package.json", type: "file" }],
  });
  mocks.openWorkspaceDirectory.mockResolvedValue({});
  mocks.readPlanFile.mockResolvedValue({
    file: { content: "", name: "", path: "", byteCount: 0, lineCount: 0, status: "ready" },
  });
  mocks.readWorkspaceFile.mockResolvedValue({
    file: {
      content: '{ "name": "willow" }',
      modifiedAt: 1,
      name: "package.json",
      relativePath: "package.json",
      size: 20,
      status: "ready",
    },
  });
  mocks.searchFiles.mockResolvedValue({ files: [] });
  mocks.subscribeWorkspaceFiles.mockResolvedValue({});
  mocks.unsubscribeWorkspaceFiles.mockResolvedValue({});
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
    const mountedSidebar = container.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]');

    expect(mountedSidebar?.style.display).toBe("none");
    toggle.click();
    await nextTick();

    const layout = getLayout(container);
    const rightSidebar = container.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]');
    expect(rightSidebar?.parentElement).toBe(layout);
    expect(rightSidebar?.style.display).not.toBe("none");
    expect(rightSidebar?.dataset.workspaceId).toBe("1");
    expect(layout.style.gridTemplateColumns).toBe("672px 8px minmax(0, 1fr)");
    expect(localStorage.getItem(rightSidebarOpenStorageKey("session-a"))).toBe("true");

    rightSidebar?.querySelector<HTMLButtonElement>('[data-panel-launcher="file"]')?.click();
    await vi.waitFor(() =>
      expect(rightSidebar?.querySelector('[data-entry-id="package.json"]')).not.toBeNull(),
    );
    rightSidebar?.querySelector<HTMLButtonElement>('[data-entry-id="package.json"]')?.click();
    await vi.waitFor(() =>
      expect(rightSidebar?.querySelector("[role=tab]")?.textContent).toContain("package.json"),
    );

    toggle.click();
    await nextTick();
    expect(rightSidebar?.style.display).toBe("none");
    toggle.click();
    await nextTick();
    expect(rightSidebar?.querySelector("[role=tab]")?.textContent).toContain("package.json");

    mountedApps.pop()?.unmount();
    container.remove();
    const restoredContainer = await mountChatBase();
    expect(getToggle(restoredContainer).getAttribute("aria-expanded")).toBe("true");
    expect(
      restoredContainer.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]')?.style
        .display,
    ).not.toBe("none");
    expect(
      restoredContainer.querySelector('[data-slot="chat-right-sidebar"] [role="tab"]')
        ?.textContent,
    ).toContain("package.json");

    getToggle(restoredContainer).click();
    await nextTick();
    expect(
      restoredContainer.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]')?.style
        .display,
    ).toBe("none");
    expect(localStorage.getItem(rightSidebarOpenStorageKey("session-a"))).toBe("false");
  });

  it("collapses the sidebar when the last tab is closed manually", async () => {
    const container = await mountChatBase();
    getToggle(container).click();
    await nextTick();

    const rightSidebar = container.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]');
    rightSidebar?.querySelector<HTMLButtonElement>('[data-panel-launcher="board"]')?.click();
    await nextTick();

    expect(
      rightSidebar?.querySelector('[data-panel-kind="board"][data-slot="right-sidebar-tab"]'),
    ).not.toBeNull();

    rightSidebar?.querySelector<HTMLButtonElement>('button[aria-label="关闭 看板"]')?.click();
    await nextTick();

    expect(rightSidebar?.style.display).toBe("none");
    expect(getToggle(container).getAttribute("aria-expanded")).toBe("false");
    expect(localStorage.getItem(rightSidebarOpenStorageKey("session-a"))).toBe("false");
  });

  it("persists open state independently for home and each session", async () => {
    localStorage.setItem(rightSidebarOpenStorageKey("session-a"), "true");
    const container = await mountChatBase();
    const router = mountedRouter;
    if (!router) throw new Error("router was not initialized");

    expect(getToggle(container).getAttribute("aria-expanded")).toBe("true");

    await router.push("/chat/session-b?workspaceId=1");
    await nextTick();
    expect(getToggle(container).getAttribute("aria-expanded")).toBe("false");

    getToggle(container).click();
    await nextTick();
    expect(localStorage.getItem(rightSidebarOpenStorageKey("session-b"))).toBe("true");

    await router.push("/?workspaceId=1");
    await nextTick();
    expect(getToggle(container).getAttribute("aria-expanded")).toBe("false");

    getToggle(container).click();
    await nextTick();
    expect(localStorage.getItem(rightSidebarOpenStorageKey("home"))).toBe("true");

    await router.push("/chat/session-a?workspaceId=1");
    await nextTick();
    expect(getToggle(container).getAttribute("aria-expanded")).toBe("true");
  });

  it("replaces existing composer text with the create-board skill and style template", async () => {
    mocks.getSkillList.mockResolvedValue({
      skills: [
        {
          description: "Create a project overview board",
          filePath: "/app/resources/skills/create-board/SKILL.md",
          name: "create-board",
          source: "builtin",
        },
      ],
    });
    const container = await mountChatBase();
    const editor = container.querySelector<HTMLElement>('[data-slot="prompt-editor"]');
    if (!editor) throw new Error("prompt editor was not rendered");
    editor.replaceChildren(document.createTextNode("discard this text"));
    editor.dispatchEvent(new InputEvent("input", { bubbles: true }));

    getToggle(container).click();
    await nextTick();
    const rightSidebar = container.querySelector<HTMLElement>('[data-slot="chat-right-sidebar"]');
    rightSidebar?.querySelector<HTMLButtonElement>('[data-panel-launcher="board"]')?.click();
    const createButton = await vi.waitFor(() => {
      const candidate = [...(rightSidebar?.querySelectorAll("button") ?? [])].find((element) =>
        element.textContent?.includes("创建看板"),
      );
      expect(candidate).toBeDefined();
      return candidate as HTMLButtonElement;
    });
    createButton.click();

    await vi.waitFor(() => {
      expect(editor.textContent).not.toContain("discard this text");
      expect(editor.textContent).toContain("参考当前项目生成适应的看板， 风格参考");
      expect(
        editor.querySelector(
          '[data-token-source="[!create-board](/app/resources/skills/create-board/SKILL.md)"]',
        ),
      ).not.toBeNull();
      const styleSelect = editor.querySelector<HTMLButtonElement>('[aria-label="选择风格"]');
      expect(styleSelect).not.toBeNull();
      expect(styleSelect?.textContent).toContain("选择风格");
      expect(document.activeElement).toBe(styleSelect);
    });
  });

  it("keeps the main pane stable while the container width changes", async () => {
    localStorage.setItem(rightSidebarOpenStorageKey("session-a"), "true");
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
    localStorage.setItem(rightSidebarOpenStorageKey("session-a"), "true");
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

  it("keeps receiving pointer events over iframe content while resizing", async () => {
    localStorage.setItem(rightSidebarOpenStorageKey("session-a"), "true");
    const container = await mountChatBase();
    const initialMainPaneWidth = Number.parseFloat(getLayout(container).style.gridTemplateColumns);

    getHandle(container).dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 679 }),
    );
    await nextTick();

    const overlay = container.querySelector<HTMLElement>(
      '[data-slot="chat-right-sidebar-resize-overlay"]',
    );
    expect(overlay).not.toBeNull();

    overlay?.dispatchEvent(new MouseEvent("pointermove", { bubbles: true, clientX: 640 }));
    await nextTick();
    const resizedMainPaneWidth = initialMainPaneWidth - 39;
    expect(getLayout(container).style.gridTemplateColumns).toBe(
      `${resizedMainPaneWidth}px 8px minmax(0, 1fr)`,
    );

    overlay?.dispatchEvent(new MouseEvent("pointerup", { bubbles: true }));
    await nextTick();
    expect(container.querySelector('[data-slot="chat-right-sidebar-resize-overlay"]')).toBeNull();
    expect(localStorage.getItem("willow:chat-right-sidebar-width")).toBe(
      String(layoutWidth - resizedMainPaneWidth - 8),
    );
  });

  it("clamps and persists pointer and keyboard resizing", async () => {
    localStorage.setItem(rightSidebarOpenStorageKey("session-a"), "true");
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
    localStorage.setItem(rightSidebarOpenStorageKey("session-a"), "true");
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
