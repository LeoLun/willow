// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, vShow, withDirectives, type App } from "vue";

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
    listWorkspaceDirectory: fileMocks.listWorkspaceDirectory,
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

import {
  getRightSidebarPanelDefinition,
  rightSidebarPanelDefinitions,
} from "../src/renderer/src/components/right-sidebar/panel-registry";
import RightSidebar from "../src/renderer/src/components/right-sidebar/RightSidebar.vue";

const mountedApps: App[] = [];

beforeEach(() => {
  vi.clearAllMocks();
});

function mountSidebar() {
  const workspaceId = ref<number | undefined>(1);
  const visible = ref(true);
  const container = document.createElement("div");
  container.style.height = "800px";
  document.body.append(container);
  const app = createApp({
    render: () =>
      withDirectives(
        h(RightSidebar, {
          id: "test-right-sidebar",
          workspaceId: workspaceId.value,
        }),
        [[vShow, visible.value]],
      ),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, visible, workspaceId };
}

function launcher(container: HTMLElement, kind: "file" | "review"): HTMLButtonElement {
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

describe("right sidebar panel registry", () => {
  it("drives launch surfaces and multiplicity from typed definitions", () => {
    expect(rightSidebarPanelDefinitions.map(({ kind }) => kind)).toEqual(["review", "file"]);
    expect(getRightSidebarPanelDefinition("file").multiplicity).toBe("multiple");
    expect(getRightSidebarPanelDefinition("review").multiplicity).toBe("single");
    expect(rightSidebarPanelDefinitions.every(({ entryPoints }) => entryPoints.emptyState)).toBe(
      true,
    );
    expect(rightSidebarPanelDefinitions.every(({ entryPoints }) => entryPoints.addMenu)).toBe(true);
  });
});

describe("RightSidebar", () => {
  it("renders registry launchers and returns to the empty state after closing the last tab", async () => {
    const { container } = mountSidebar();

    expect(container.querySelectorAll("[data-panel-launcher]")).toHaveLength(2);
    launcher(container, "review").click();
    await nextTick();

    expect(
      container.querySelectorAll('[data-panel-kind="review"][data-slot="right-sidebar-tab"]'),
    ).toHaveLength(1);
    expect(container.querySelector('[data-slot="right-sidebar-review-panel"]')).not.toBeNull();

    const close = container.querySelector<HTMLButtonElement>('button[aria-label="关闭 审阅"]');
    close?.click();
    await nextTick();

    expect(container.querySelector("[data-slot=right-sidebar-empty-state]")).not.toBeNull();
    expect(container.querySelector("[data-slot=right-sidebar-review-panel]")).toBeNull();
  });

  it("keeps review single-instance and allows multiple independent file tabs", async () => {
    const { container } = mountSidebar();
    launcher(container, "review").click();
    await nextTick();
    await addFromMenu(container, "审阅");

    expect(container.querySelectorAll('[data-slot="right-sidebar-tab"]')).toHaveLength(1);

    await addFromMenu(container, "文件");
    await addFromMenu(container, "文件");
    expect(
      container.querySelectorAll('[data-panel-kind="file"][data-slot="right-sidebar-tab"]'),
    ).toHaveLength(2);
    expect(container.querySelectorAll('[data-slot="right-sidebar-file-panel"]')).toHaveLength(2);
  });

  it("updates only the active file tab title and preserves mounted panel state", async () => {
    const { container, visible } = mountSidebar();
    launcher(container, "file").click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="package.json"]')).not.toBeNull(),
    );

    container.querySelector<HTMLButtonElement>('[data-entry-id="package.json"]')?.click();
    await vi.waitFor(() =>
      expect(tabActivations(container)[0]?.textContent).toContain("package.json"),
    );

    await addFromMenu(container, "文件");
    await vi.waitFor(() =>
      expect(container.querySelectorAll('[data-entry-id="README.md"]')).toHaveLength(2),
    );
    expect(tabActivations(container)[1]?.textContent).toContain("打开文件");
    container.querySelectorAll<HTMLButtonElement>('[data-entry-id="README.md"]')[1]?.click();
    await vi.waitFor(() =>
      expect(tabActivations(container)[1]?.textContent).toContain("README.md"),
    );

    expect(tabActivations(container)[0]?.textContent).toContain("package.json");
    expect(tabActivations(container)[1]?.textContent).toContain("README.md");

    tabActivations(container)[0]?.click();
    await nextTick();
    const panels = container.querySelectorAll<HTMLElement>("[data-slot=right-sidebar-tab-panel]");
    expect(panels[0]?.style.display).not.toBe("none");
    expect(panels[1]?.style.display).toBe("none");
    expect(
      panels[0]?.querySelector('[data-slot="monaco-code-viewer"]')?.getAttribute("data-language"),
    ).toBe("json");

    visible.value = false;
    await nextTick();
    visible.value = true;
    await nextTick();
    expect(tabActivations(container)[0]?.textContent).toContain("package.json");
  });

  it("renders a collapsed tree and keeps directory toggles out of file selection", async () => {
    const { container } = mountSidebar();
    launcher(container, "file").click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="apps"]')).not.toBeNull(),
    );

    const apps = container.querySelector<HTMLButtonElement>('[data-entry-id="apps"]');
    expect(apps?.getAttribute("aria-expanded")).toBe("false");
    expect(apps?.querySelector("img")?.dataset.iconName).toBe("folder-app");
    expect(apps?.querySelector("img")?.getAttribute("src")).toContain("folder-app.svg");
    expect(
      container.querySelector(
        '[data-entry-id="apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue"]',
      ),
    ).toBeNull();

    apps?.click();
    await vi.waitFor(() =>
      expect(
        container.querySelector(
          '[data-entry-id="apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue"]',
        ),
      ).not.toBeNull(),
    );
    expect(apps?.getAttribute("aria-expanded")).toBe("true");
    expect(apps?.querySelector("img")?.getAttribute("src")).toContain("folder-app-open.svg");
    expect(apps?.getAttribute("aria-selected")).toBe("false");
    expect(tabActivations(container)[0]?.textContent).toContain("打开文件");
    expect(
      container.querySelector(
        '[data-entry-id="apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue"]',
      ),
    ).not.toBeNull();

    container.querySelector<HTMLButtonElement>('[data-entry-id="package.json"]')?.click();
    await nextTick();
    expect(apps?.getAttribute("aria-expanded")).toBe("true");
    expect(
      container.querySelector(
        '[data-entry-id="apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue"]',
      ),
    ).not.toBeNull();
    expect(tabActivations(container)[0]?.textContent).toContain("package.json");

    apps?.click();
    await nextTick();
    expect(apps?.getAttribute("aria-expanded")).toBe("false");
    expect(
      container.querySelector(
        '[data-entry-id="apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue"]',
      ),
    ).toBeNull();
    expect(tabActivations(container)[0]?.textContent).toContain("package.json");
  });

  it("selects files with the tree keyboard interaction", async () => {
    const { container } = mountSidebar();
    launcher(container, "file").click();
    await vi.waitFor(() =>
      expect(container.querySelector('[data-entry-id="package.json"]')).not.toBeNull(),
    );

    const packageJson = container.querySelector<HTMLButtonElement>(
      '[data-entry-id="package.json"]',
    );
    packageJson?.focus();
    packageJson?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));
    await vi.waitFor(() =>
      expect(tabActivations(container)[0]?.textContent).toContain("package.json"),
    );

    expect(packageJson).toBe(document.activeElement);
    expect(packageJson?.querySelector("img")?.dataset.iconName).toBe("nodejs");
    expect(packageJson?.querySelector("img")?.getAttribute("src")).toContain("nodejs.svg");
    expect(packageJson?.getAttribute("aria-selected")).toBe("true");
    expect(tabActivations(container)[0]?.textContent).toContain("package.json");
    expect(
      container.querySelector('[data-slot="monaco-code-viewer"]')?.getAttribute("data-language"),
    ).toBe("json");
  });

  it("supports keyboard navigation and clears tabs when the workspace changes", async () => {
    const { container, workspaceId } = mountSidebar();
    launcher(container, "file").click();
    await nextTick();
    await addFromMenu(container, "文件");

    const firstTab = tabActivations(container)[0];
    firstTab?.focus();
    firstTab?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }));
    await nextTick();
    expect(tabActivations(container)[1]).toBe(document.activeElement);

    tabActivations(container)[1]?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, key: "Delete" }),
    );
    await nextTick();
    expect(tabActivations(container)).toHaveLength(1);

    workspaceId.value = 2;
    await nextTick();
    expect(container.querySelector("[data-slot=right-sidebar-empty-state]")).not.toBeNull();
    expect(tabActivations(container)).toHaveLength(0);
  });
});
