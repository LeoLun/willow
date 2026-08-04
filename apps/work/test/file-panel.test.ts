// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, ref, type App } from "vue";
import type { FilePanelState } from "../src/renderer/src/components/right-sidebar/types";
import type { WorkspaceFilesChangedEvent } from "../src/shared/api";

const mocks = vi.hoisted(() => ({
  eventCallback: undefined as ((data: WorkspaceFilesChangedEvent) => void) | undefined,
  getWorkspaceList: vi.fn(),
  listWorkspaceDirectory: vi.fn(),
  openWorkspaceFile: vi.fn(async () => ({})),
  readWorkspaceFile: vi.fn(),
  revealWorkspaceEntry: vi.fn(async () => ({})),
  searchFiles: vi.fn(),
  subscribeWorkspaceFiles: vi.fn(async () => ({})),
  unsubscribeWorkspaceFiles: vi.fn(async () => ({})),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getWorkspaceList: mocks.getWorkspaceList,
    listWorkspaceDirectory: mocks.listWorkspaceDirectory,
    openWorkspaceFile: mocks.openWorkspaceFile,
    readWorkspaceFile: mocks.readWorkspaceFile,
    revealWorkspaceEntry: mocks.revealWorkspaceEntry,
    searchFiles: mocks.searchFiles,
    subscribeWorkspaceFiles: mocks.subscribeWorkspaceFiles,
    unsubscribeWorkspaceFiles: mocks.unsubscribeWorkspaceFiles,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: (_event: string, callback: (data: WorkspaceFilesChangedEvent) => void) => {
      mocks.eventCallback = callback;
    },
    removeEventListener: vi.fn(),
    waitUntilReady: vi.fn(async () => undefined),
  }),
}));

vi.mock("../src/renderer/src/components/right-sidebar/MonacoCodeViewer.vue", () => ({
  default: defineComponent({
    props: { code: String, language: String },
    setup(props) {
      return () =>
        h("div", {
          "data-code": props.code,
          "data-language": props.language,
          "data-slot": "monaco-code-viewer",
        });
    },
  }),
}));

import FilePanel from "../src/renderer/src/components/right-sidebar/FilePanel.vue";

const mountedApps: App[] = [];
const intersectionObservers: FakeIntersectionObserver[] = [];
const resizeObservers: FakeResizeObserver[] = [];
let splitLayoutWidth = 480;
const writeClipboardText = vi.fn(async () => undefined);
let legacyClipboardText = "";

class FakeIntersectionObserver {
  constructor(private readonly callback: IntersectionObserverCallback) {
    intersectionObservers.push(this);
  }

  disconnect() {}
  observe() {}
  takeRecords() {
    return [];
  }
  unobserve() {}

  emit() {
    this.callback([{ isIntersecting: true } as IntersectionObserverEntry], this as never);
  }
}

class FakeResizeObserver {
  readonly disconnect = vi.fn();

  constructor(private readonly callback: ResizeObserverCallback) {
    resizeObservers.push(this);
  }

  observe() {}
  unobserve() {}

  emit(width: number): void {
    splitLayoutWidth = width;
    this.callback(
      [{ contentRect: { width } } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    );
  }
}

function mountPanel(initialState: FilePanelState = {}) {
  const state = ref<FilePanelState>(initialState);
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(FilePanel, {
        "onUpdate:state": (value) => {
          state.value = value;
        },
        state: state.value,
        tabId: "file-tab",
        workspaceId: 1,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, state };
}

async function openContextMenu(trigger: Element): Promise<HTMLElement> {
  trigger.dispatchEvent(
    new MouseEvent("contextmenu", {
      bubbles: true,
      button: 2,
      cancelable: true,
      clientX: 20,
      clientY: 20,
    }),
  );
  return await vi.waitFor(() => {
    const menu = document.body.querySelector<HTMLElement>('[data-slot="context-menu-content"]');
    expect(menu).not.toBeNull();
    return menu!;
  });
}

function getMenuItem(menu: HTMLElement, label: string): HTMLElement {
  const item = [...menu.querySelectorAll<HTMLElement>('[data-slot="context-menu-item"]')].find(
    (candidate) => candidate.textContent?.includes(label),
  );
  if (!item) throw new Error(`Context menu item not found: ${label}`);
  return item;
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mocks.eventCallback = undefined;
  intersectionObservers.splice(0);
  resizeObservers.splice(0);
  splitLayoutWidth = 480;
  legacyClipboardText = "";
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
  vi.stubGlobal("ResizeObserver", FakeResizeObserver);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText: writeClipboardText },
  });
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    value: vi.fn(() => {
      legacyClipboardText = document.querySelector<HTMLTextAreaElement>("textarea")?.value ?? "";
      return true;
    }),
  });
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const width =
      (this as HTMLElement).dataset.slot === "file-panel-split-layout" ? splitLayoutWidth : 0;
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
  mocks.readWorkspaceFile.mockImplementation(async ({ relativePath }) => ({
    file: {
      content: `content:${relativePath}`,
      modifiedAt: 1,
      name: relativePath.split("/").at(-1),
      relativePath,
      size: 10,
      status: "ready",
    },
  }));
  mocks.getWorkspaceList.mockImplementation(async ({ pinned }) => ({
    workspaces: pinned
      ? []
      : [
          {
            createdAt: new Date(0),
            id: 1,
            name: "willow",
            path: "/code/willow",
            pinned: false,
            updatedAt: new Date(0),
          },
        ],
  }));
  mocks.searchFiles.mockResolvedValue({ files: [] });
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  vi.unstubAllGlobals();
});

describe("FilePanel", () => {
  it("renders the workspace-relative file path as breadcrumbs", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    const { container } = mountPanel({
      selectedFile: {
        id: "packages/shadcn/package.json",
        name: "package.json",
        path: "packages/shadcn/package.json",
      },
    });

    const breadcrumb = await vi.waitFor(() => {
      const element = container.querySelector<HTMLElement>('[data-slot="file-panel-breadcrumb"]');
      expect(element?.textContent).toContain("package.json");
      return element!;
    });
    const segments = [
      ...breadcrumb.querySelectorAll<HTMLElement>('[data-slot="file-panel-breadcrumb-segment"]'),
    ];

    expect(segments.map((segment) => segment.textContent?.trim())).toEqual([
      "willow",
      "packages",
      "shadcn",
      "package.json",
    ]);
    expect(breadcrumb.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(3);
    expect(
      segments.slice(0, -1).every((segment) => segment.classList.contains("text-muted-foreground")),
    ).toBe(true);
    expect(segments.at(-1)?.classList.contains("font-medium")).toBe(true);
    expect(breadcrumb.title).toBe("willow/packages/shadcn/package.json");
  });

  it("renders only the workspace name until a root file is selected", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    const { container, state } = mountPanel();
    const segments = () => [
      ...container.querySelectorAll<HTMLElement>('[data-slot="file-panel-breadcrumb-segment"]'),
    ];

    await vi.waitFor(() =>
      expect(segments().map((segment) => segment.textContent?.trim())).toEqual(["willow"]),
    );
    expect(container.querySelectorAll('[data-slot="file-panel-breadcrumb"] svg')).toHaveLength(0);

    state.value = {
      selectedFile: { id: "README.md", name: "README.md", path: "README.md" },
    };
    await nextTick();

    expect(segments().map((segment) => segment.textContent?.trim())).toEqual([
      "willow",
      "README.md",
    ]);
    expect(container.querySelectorAll('[data-slot="file-panel-breadcrumb"] svg')).toHaveLength(1);
  });

  it("falls back to the root placeholder when the workspace lookup fails", async () => {
    mocks.getWorkspaceList.mockRejectedValue(new Error("workspace unavailable"));
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    const { container, state } = mountPanel();

    await vi.waitFor(() => expect(mocks.getWorkspaceList).toHaveBeenCalledTimes(2));
    state.value = {
      selectedFile: { id: "src/main.ts", name: "main.ts", path: "src/main.ts" },
    };
    await nextTick();
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-slot="monaco-code-viewer"]')?.getAttribute("data-code"),
      ).toBe("content:src/main.ts"),
    );
    expect(
      container.querySelector('[data-slot="file-panel-breadcrumb"]')?.textContent?.trim(),
    ).toBe("/");
  });

  it("resizes the browser with pointer and keyboard input up to a 1:1 split", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    const { container } = mountPanel();
    await nextTick();

    const layout = container.querySelector<HTMLElement>('[data-slot="file-panel-split-layout"]');
    const handle = container.querySelector<HTMLElement>('[data-slot="file-panel-resize-handle"]');
    if (!layout || !handle) throw new Error("file panel resize controls were not rendered");

    expect(layout.style.gridTemplateColumns).toBe("315px 8px 157px");
    expect(handle.getAttribute("role")).toBe("separator");
    expect(handle.getAttribute("aria-orientation")).toBe("vertical");
    expect(handle.getAttribute("aria-valuemin")).toBe("152");
    expect(handle.getAttribute("aria-valuemax")).toBe("236");
    expect(handle.getAttribute("aria-valuenow")).toBe("157");

    handle.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 315 }),
    );
    expect(document.body.style.userSelect).toBe("none");
    window.dispatchEvent(new MouseEvent("pointermove", { clientX: 100 }));
    await nextTick();
    expect(layout.style.gridTemplateColumns).toBe("236px 8px 236px");

    window.dispatchEvent(new MouseEvent("pointerup"));
    expect(document.body.style.userSelect).toBe("");
    expect(localStorage.getItem("willow:file-panel-browser-width")).toBe("236");

    handle.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    await nextTick();
    expect(layout.style.gridTemplateColumns).toBe("252px 8px 220px");
    expect(localStorage.getItem("willow:file-panel-browser-width")).toBe("220");
  });

  it("restores and clamps the saved browser width when the panel narrows", async () => {
    localStorage.setItem("willow:file-panel-browser-width", "220");
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    const { container } = mountPanel();
    await nextTick();

    const layout = container.querySelector<HTMLElement>('[data-slot="file-panel-split-layout"]');
    const handle = container.querySelector<HTMLElement>('[data-slot="file-panel-resize-handle"]');
    if (!layout || !handle) throw new Error("file panel resize controls were not rendered");
    expect(layout.style.gridTemplateColumns).toBe("252px 8px 220px");

    resizeObservers.at(-1)?.emit(320);
    await nextTick();
    expect(layout.style.gridTemplateColumns).toBe("156px 8px 156px");
    expect(handle.getAttribute("aria-valuemax")).toBe("156");
    expect(handle.getAttribute("aria-valuenow")).toBe("156");

    handle.dispatchEvent(
      new MouseEvent("pointerdown", { bubbles: true, button: 0, cancelable: true, clientX: 160 }),
    );
    const observer = resizeObservers.at(-1);
    mountedApps.pop()?.unmount();
    expect(observer?.disconnect).toHaveBeenCalledOnce();
    expect(document.body.style.userSelect).toBe("");
  });

  it("shows and hides the file list from the header button", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    const { container } = mountPanel();
    await nextTick();

    const layout = container.querySelector<HTMLElement>('[data-slot="file-panel-split-layout"]');
    const handle = container.querySelector<HTMLElement>('[data-slot="file-panel-resize-handle"]');
    const browser = container.querySelector<HTMLElement>('[data-slot="file-panel-browser"]');
    const toggle = container.querySelector<HTMLButtonElement>('[aria-label="隐藏文件列表"]');
    if (!layout || !handle || !browser || !toggle) {
      throw new Error("file panel list controls were not rendered");
    }

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    toggle.click();
    await nextTick();

    expect(layout.style.gridTemplateColumns).toBe("minmax(0, 1fr)");
    expect(handle.style.display).toBe("none");
    expect(browser.style.display).toBe("none");
    expect(toggle.getAttribute("aria-label")).toBe("显示文件列表");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");

    toggle.click();
    await nextTick();

    expect(layout.style.gridTemplateColumns).toBe("315px 8px 157px");
    expect(handle.style.display).toBe("");
    expect(browser.style.display).toBe("");
    expect(toggle.getAttribute("aria-label")).toBe("隐藏文件列表");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
  });

  it("loads the root page and automatically requests the next cursor", async () => {
    mocks.listWorkspaceDirectory
      .mockResolvedValueOnce({
        entries: [{ name: "first.txt", relativePath: "first.txt", type: "file" }],
        nextCursor: "next-page",
      })
      .mockResolvedValueOnce({
        entries: [{ name: "second.txt", relativePath: "second.txt", type: "file" }],
      });
    const { container } = mountPanel();

    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="first.txt"]')).not.toBeNull(),
    );
    expect(mocks.listWorkspaceDirectory).toHaveBeenNthCalledWith(1, {
      directoryPath: "",
      limit: 200,
      workspaceId: 1,
    });

    intersectionObservers.at(-1)?.emit();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="second.txt"]')).not.toBeNull(),
    );
    expect(mocks.listWorkspaceDirectory).toHaveBeenNthCalledWith(2, {
      cursor: "next-page",
      directoryPath: "",
      limit: 200,
      workspaceId: 1,
    });
  });

  it("searches, previews selected files, refreshes changes, and clears deleted files", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    mocks.searchFiles.mockResolvedValue({
      files: [{ name: "main.ts", relativePath: "src/main.ts", type: "file" }],
    });
    const { container, state } = mountPanel();
    const input = container.querySelector<HTMLInputElement>('input[placeholder="筛选文件…"]');
    if (!input) throw new Error("search input was not rendered");

    input.value = "main";
    input.dispatchEvent(new Event("input", { bubbles: true }));
    await vi.waitFor(() =>
      expect(mocks.searchFiles).toHaveBeenCalledWith({ workspaceId: 1, query: "main" }),
    );
    const result = await vi.waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>(
        '[data-slot="file-panel-search-results"] button',
      );
      expect(button).not.toBeNull();
      return button!;
    });
    result.click();

    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-slot="monaco-code-viewer"]')?.getAttribute("data-code"),
      ).toBe("content:src/main.ts"),
    );
    expect(state.value).toMatchObject({ selectedFile: { path: "src/main.ts" } });

    mocks.eventCallback?.({
      changes: [{ relativePath: "src/main.ts", type: "change" }],
      workspaceId: 1,
    });
    await vi.waitFor(() => expect(mocks.readWorkspaceFile).toHaveBeenCalledTimes(2));

    mocks.eventCallback?.({
      changes: [{ relativePath: "src/main.ts", type: "unlink" }],
      workspaceId: 1,
    });
    await nextTick();
    expect(container.querySelector('[data-slot="file-preview-deleted"]')).not.toBeNull();
    expect(state.value).toEqual({});

    mountedApps.pop()?.unmount();
    await nextTick();
    expect(mocks.unsubscribeWorkspaceFiles).toHaveBeenCalledWith({ subscriptionId: "file-tab" });
  });

  it.each([
    ["too-large", "file-preview-too-large"],
    ["binary", "file-preview-binary"],
  ] as const)("opens %s files with the system application", async (status, slot) => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    mocks.readWorkspaceFile.mockResolvedValue({
      file: {
        modifiedAt: 1,
        name: "asset.dat",
        relativePath: "assets/asset.dat",
        size: 2,
        status,
      },
    });
    const { container, state } = mountPanel();
    await vi.waitFor(() => expect(mocks.subscribeWorkspaceFiles).toHaveBeenCalledOnce());
    state.value = {
      selectedFile: {
        id: "assets/asset.dat",
        name: "asset.dat",
        path: "assets/asset.dat",
      },
    };
    await nextTick();

    const button = await vi.waitFor(() => {
      const element = container.querySelector<HTMLButtonElement>(`[data-slot="${slot}"] button`);
      expect(element?.textContent).toContain("使用系统原生应用打开");
      return element!;
    });
    button.click();

    await vi.waitFor(() =>
      expect(mocks.openWorkspaceFile).toHaveBeenCalledWith({
        relativePath: "assets/asset.dat",
        workspaceId: 1,
      }),
    );
  });

  it("provides file actions from the tree without changing the selection", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({
      entries: [{ name: "main.ts", relativePath: "src/main.ts", type: "file" }],
    });
    const selectedFile = { id: "README.md", name: "README.md", path: "README.md" };
    const { container, state } = mountPanel({ selectedFile });
    const trigger = await vi.waitFor(() => {
      const element = container.querySelector('[data-entry-id="src/main.ts"]');
      expect(element).not.toBeNull();
      return element!;
    });

    let menu = await openContextMenu(trigger);
    expect(
      [...menu.querySelectorAll('[data-slot="context-menu-item"]')].map((item) =>
        item.textContent?.trim(),
      ),
    ).toEqual(["打开所在文件夹", "使用系统应用打开", "复制文件路径"]);
    getMenuItem(menu, "打开所在文件夹").click();
    await vi.waitFor(() =>
      expect(mocks.revealWorkspaceEntry).toHaveBeenCalledWith({
        workspaceId: 1,
        relativePath: "src/main.ts",
      }),
    );

    menu = await openContextMenu(trigger);
    getMenuItem(menu, "使用系统应用打开").click();
    await vi.waitFor(() =>
      expect(mocks.openWorkspaceFile).toHaveBeenCalledWith({
        workspaceId: 1,
        relativePath: "src/main.ts",
      }),
    );

    menu = await openContextMenu(trigger);
    getMenuItem(menu, "复制文件路径").click();
    await vi.waitFor(() => expect(legacyClipboardText).toBe("src/main.ts"));
    expect(state.value).toEqual({ selectedFile });
  });

  it("provides only the reveal action for directories in search results", async () => {
    mocks.listWorkspaceDirectory.mockResolvedValue({ entries: [] });
    mocks.searchFiles.mockResolvedValue({
      files: [{ name: "components", relativePath: "src/components/", type: "directory" }],
    });
    const selectedFile = { id: "README.md", name: "README.md", path: "README.md" };
    const { container, state } = mountPanel({ selectedFile });
    const input = await vi.waitFor(() => {
      const element = container.querySelector<HTMLInputElement>('input[placeholder="筛选文件…"]');
      expect(element).not.toBeNull();
      return element!;
    });
    input.value = "components";
    input.dispatchEvent(new Event("input", { bubbles: true }));

    const trigger = await vi.waitFor(() => {
      const element = container.querySelector('[data-entry-type="directory"]');
      expect(element).not.toBeNull();
      return element!;
    });
    expect(trigger.getAttribute("aria-disabled")).toBe("true");
    const menu = await openContextMenu(trigger);
    expect(menu.querySelectorAll('[data-slot="context-menu-item"]')).toHaveLength(1);
    getMenuItem(menu, "打开所在文件夹").click();

    await vi.waitFor(() =>
      expect(mocks.revealWorkspaceEntry).toHaveBeenCalledWith({
        workspaceId: 1,
        relativePath: "src/components",
      }),
    );
    expect(state.value).toEqual({ selectedFile });
  });
});
