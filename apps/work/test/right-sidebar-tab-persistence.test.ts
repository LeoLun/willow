// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, shallowRef, vShow, withDirectives, type App } from "vue";

const monacoMock = vi.hoisted(() => {
  const create = vi.fn((_element: HTMLElement, options?: { value?: string }) => {
    let value = options?.value ?? "";
    const model = {
      dispose: vi.fn(),
      getValue: vi.fn(() => value),
      setValue: vi.fn((nextValue: string) => {
        value = nextValue;
      }),
    };
    return {
      dispose: vi.fn(),
      getModel: vi.fn(() => model),
      updateOptions: vi.fn(),
    };
  });
  const api = {
    editor: {
      ShowLightbulbIconMode: { Off: "off" },
      create,
      setModelLanguage: vi.fn(),
      setTheme: vi.fn(),
    },
  };

  return { api, loadMonaco: vi.fn(async () => api) };
});

const fileMocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getBoardPanel: vi.fn(async () => ({ status: "missing" as const })),
  getGitReviewStatus: vi.fn(async () => ({ review: { repository: false as const } })),
  getSkillList: vi.fn(async () => ({ skills: [] })),
  listWorkspaceDirectory: vi.fn(async ({ directoryPath }: { directoryPath: string }) => ({
    entries:
      directoryPath === "apps"
        ? [
            {
              name: "RightSidebar.vue",
              relativePath: "apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue",
              type: "file" as const,
            },
          ]
        : [
            { name: "apps", relativePath: "apps/", type: "directory" as const },
            { name: "package.json", relativePath: "package.json", type: "file" as const },
            { name: "README.md", relativePath: "README.md", type: "file" as const },
          ],
  })),
  readPlanFile: vi.fn(async () => ({
    file: {
      content: "# Restored Plan",
      name: "2026-08-13-foo.md",
      path: "/Users/me/.willow/plan/2026-08-13-foo.md",
      byteCount: 15,
      lineCount: 1,
      status: "ready" as const,
    },
  })),
  readWorkspaceFile: vi.fn(async ({ relativePath }: { relativePath: string }) => ({
    file: {
      content: relativePath.endsWith(".json") ? '{ "name": "willow" }' : "# Willow",
      modifiedAt: 1,
      name: relativePath.split("/").at(-1) ?? relativePath,
      relativePath,
      size: 10,
      status: "ready" as const,
    },
  })),
  removeEventListener: vi.fn(),
  searchFiles: vi.fn(async () => ({ files: [] })),
  subscribeWorkspaceFiles: vi.fn(async () => ({})),
  unsubscribeWorkspaceFiles: vi.fn(async () => ({})),
  waitUntilReady: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getBoardPanel: fileMocks.getBoardPanel,
    getGitReviewStatus: fileMocks.getGitReviewStatus,
    getSkillList: fileMocks.getSkillList,
    listWorkspaceDirectory: fileMocks.listWorkspaceDirectory,
    readPlanFile: fileMocks.readPlanFile,
    readWorkspaceFile: fileMocks.readWorkspaceFile,
    searchFiles: fileMocks.searchFiles,
    subscribeWorkspaceFiles: fileMocks.subscribeWorkspaceFiles,
    unsubscribeWorkspaceFiles: fileMocks.unsubscribeWorkspaceFiles,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: fileMocks.addEventListener,
    removeEventListener: fileMocks.removeEventListener,
    waitUntilReady: fileMocks.waitUntilReady,
  }),
}));

vi.mock("../src/renderer/src/components/right-sidebar/monaco", () => ({
  loadMonaco: monacoMock.loadMonaco,
}));

vi.mock("@/composables/useDarkMode", async () => {
  const { ref: vueRef } = await import("vue");
  const isDark = vueRef(false);
  return { useDarkMode: () => ({ isDark }) };
});

import RightSidebar from "../src/renderer/src/components/right-sidebar/RightSidebar.vue";
import {
  MAX_PERSISTED_TAB_SERIALIZED_BYTES,
  persistRightSidebarTabs,
  restoreRightSidebarTabs,
} from "../src/renderer/src/components/right-sidebar/tab-persistence";
import type { RightSidebarHandle } from "../src/renderer/src/components/right-sidebar/types";
import type { RightSidebarTab } from "../src/renderer/src/components/right-sidebar/types";

const mountedApps: App[] = [];
const tabsStorageKey = (workspaceId: number) => `willow:chat-right-sidebar-tabs:${workspaceId}`;

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
});

function mountSidebar() {
  const workspaceId = ref<number | undefined>(1);
  const visible = ref(true);
  const sidebar = shallowRef<RightSidebarHandle>();
  const container = document.createElement("div");
  container.style.height = "800px";
  document.body.append(container);
  const app = createApp({
    render: () =>
      withDirectives(
        h(RightSidebar, {
          id: "test-right-sidebar",
          ref: sidebar,
          workspaceId: workspaceId.value,
        }),
        [[vShow, visible.value]],
      ),
  });
  app.mount(container);
  mountedApps.push(app);
  return { app, container, sidebar, visible, workspaceId };
}

function launcher(container: HTMLElement, kind: "board" | "file" | "review"): HTMLButtonElement {
  const button = container.querySelector<HTMLButtonElement>(`[data-panel-launcher="${kind}"]`);
  if (!button) throw new Error(`${kind} launcher was not rendered`);
  return button;
}

function tabActivations(container: HTMLElement): HTMLButtonElement[] {
  return [...container.querySelectorAll<HTMLButtonElement>("[data-tab-activation]")];
}

async function openAddMenu(container: HTMLElement): Promise<void> {
  const trigger = container.querySelector<HTMLButtonElement>(
    'button[aria-label="添加右侧栏标签页"]',
  );
  if (!trigger) throw new Error("add menu trigger was not rendered");
  trigger.dispatchEvent(new MouseEvent("pointerdown", { bubbles: true, button: 0 }));
  trigger.click();
  await nextTick();
}

async function addFromMenu(container: HTMLElement, label: string): Promise<void> {
  await openAddMenu(container);
  const item = [
    ...document.body.querySelectorAll<HTMLElement>("[data-slot=dropdown-menu-item]"),
  ].find((candidate) => candidate.textContent?.trim() === label);
  if (!item) throw new Error(`${label} menu item was not rendered`);
  item.click();
  await nextTick();
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("right sidebar tab persistence", () => {
  it("persists plan tabs by file path only", () => {
    const tab = {
      id: "right-sidebar-tab-1",
      kind: "plan",
      state: {
        plan: {
          content: "# Full content that must not be persisted",
          fileName: "2026-08-13-foo.md",
          lineCount: 3,
          byteCount: 42,
          path: "/Users/me/.willow/plan/2026-08-13-foo.md",
        },
      },
    } satisfies RightSidebarTab;

    persistRightSidebarTabs(1, [tab], "right-sidebar-tab-1");

    const stored = JSON.parse(localStorage.getItem(tabsStorageKey(1)) ?? "null") as unknown;
    expect(stored).toMatchObject({
      version: 1,
      activeTabIndex: 0,
      tabs: [{ kind: "plan", state: { path: "/Users/me/.willow/plan/2026-08-13-foo.md" } }],
    });
    expect(localStorage.getItem(tabsStorageKey(1))).not.toContain("Full content");
  });

  it("drops tabs whose persisted form exceeds the size cap", () => {
    const hugePath = "/".concat("a".repeat(MAX_PERSISTED_TAB_SERIALIZED_BYTES));
    const tab = {
      id: "right-sidebar-tab-1",
      kind: "plan",
      state: {
        plan: { content: "", fileName: "x.md", byteCount: 0, lineCount: 0, path: hugePath },
      },
    } satisfies RightSidebarTab;

    persistRightSidebarTabs(1, [tab], "right-sidebar-tab-1");

    const stored = JSON.parse(localStorage.getItem(tabsStorageKey(1)) ?? "null") as {
      tabs: unknown[];
    };
    expect(stored.tabs).toHaveLength(0);
  });

  it("ignores corrupt, versioned, and malformed persisted data", () => {
    localStorage.setItem(tabsStorageKey(1), "{ not valid json");
    expect(restoreRightSidebarTabs(1)).toEqual({ tabs: [], activeTabIndex: null });

    localStorage.setItem(tabsStorageKey(1), JSON.stringify({ version: 2, tabs: [] }));
    expect(restoreRightSidebarTabs(1)).toEqual({ tabs: [], activeTabIndex: null });

    localStorage.setItem(
      tabsStorageKey(1),
      JSON.stringify({
        version: 1,
        activeTabIndex: 0,
        tabs: [
          { kind: "unknown", state: {} },
          { kind: "file", state: { selectedFile: { id: "", name: "", path: "" } } },
          { kind: "plan", state: {} },
        ],
      }),
    );
    const restored = restoreRightSidebarTabs(1);
    expect(restored.tabs).toEqual([{ kind: "file", state: {} }]);
    expect(restored.activeTabIndex).toBe(0);
  });
});

describe("RightSidebar tab restoration", () => {
  it("restores open file tabs after remount", async () => {
    const { app, container } = mountSidebar();
    launcher(container, "file").click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="package.json"]')).not.toBeNull(),
    );

    container.querySelector<HTMLButtonElement>('[data-entry-id="package.json"]')?.click();
    await vi.waitFor(() =>
      expect(tabActivations(container)[0]?.textContent).toContain("package.json"),
    );

    app.unmount();
    container.remove();
    monacoMock.api.editor.create.mockClear();

    const { container: restored } = mountSidebar();
    await vi.waitFor(() =>
      expect(tabActivations(restored)[0]?.textContent).toContain("package.json"),
    );
    await vi.waitFor(() =>
      expect(monacoMock.api.editor.create).toHaveBeenCalledWith(
        expect.any(HTMLElement),
        expect.objectContaining({ value: '{ "name": "willow" }' }),
      ),
    );
    expect(fileMocks.readWorkspaceFile).toHaveBeenCalledWith({
      workspaceId: 1,
      relativePath: "package.json",
    });
  });

  it("restores the active tab", async () => {
    const { app, container } = mountSidebar();
    launcher(container, "file").click();
    await nextTick();
    await addFromMenu(container, "文件");
    expect(tabActivations(container)).toHaveLength(2);

    tabActivations(container)[1]?.click();
    await nextTick();
    expect(tabActivations(container)[1]?.getAttribute("aria-selected")).toBe("true");

    app.unmount();
    container.remove();

    const { container: restored } = mountSidebar();
    await vi.waitFor(() => expect(tabActivations(restored)).toHaveLength(2));
    expect(tabActivations(restored)[1]?.getAttribute("aria-selected")).toBe("true");
  });

  it("restores plan tabs by re-reading the file", async () => {
    localStorage.setItem(
      tabsStorageKey(1),
      JSON.stringify({
        version: 1,
        activeTabIndex: 0,
        tabs: [{ kind: "plan", state: { path: "/Users/me/.willow/plan/2026-08-13-foo.md" } }],
      }),
    );

    const { container } = mountSidebar();
    await vi.waitFor(() =>
      expect(
        container.querySelector('[data-slot="right-sidebar-plan-panel"]')?.textContent,
      ).toContain("Restored Plan"),
    );
    expect(fileMocks.readPlanFile).toHaveBeenCalledWith({
      path: "/Users/me/.willow/plan/2026-08-13-foo.md",
    });
    expect(tabActivations(container)[0]?.textContent).toContain("2026-08-13-foo.md");
  });

  it("drops plan tabs when the file cannot be read", async () => {
    fileMocks.readPlanFile.mockRejectedValue(new Error("not found"));
    localStorage.setItem(
      tabsStorageKey(1),
      JSON.stringify({
        version: 1,
        activeTabIndex: 0,
        tabs: [{ kind: "plan", state: { path: "/Users/me/.willow/plan/2026-08-13-foo.md" } }],
      }),
    );

    const { container } = mountSidebar();
    await vi.waitFor(() => expect(tabActivations(container)).toHaveLength(0));
    expect(container.querySelector("[data-slot=right-sidebar-empty-state]")).not.toBeNull();
  });

  it("isolates tabs per workspace", async () => {
    const { container, workspaceId } = mountSidebar();
    launcher(container, "file").click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="package.json"]')).not.toBeNull(),
    );
    container.querySelector<HTMLButtonElement>('[data-entry-id="package.json"]')?.click();
    await vi.waitFor(() =>
      expect(tabActivations(container)[0]?.textContent).toContain("package.json"),
    );

    workspaceId.value = 2;
    await nextTick();
    expect(tabActivations(container)).toHaveLength(0);
    expect(container.querySelector("[data-slot=right-sidebar-empty-state]")).not.toBeNull();

    workspaceId.value = 1;
    await nextTick();
    await vi.waitFor(() =>
      expect(tabActivations(container)[0]?.textContent).toContain("package.json"),
    );
  });
});
