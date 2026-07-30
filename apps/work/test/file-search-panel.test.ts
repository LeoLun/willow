// @vitest-environment jsdom

import type { FileSearchItem } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, ref, shallowRef, type App } from "vue";
import type { ComposerPanelNavigationHandle } from "../src/renderer/src/components/prompt-composer";

const searchFiles = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", () => ({
  electronAPI: { searchFiles },
}));

import FileSearchPanel from "../src/renderer/src/components/prompt-composer/FileSearchPanel.vue";

const mountedApps: App[] = [];

function mountPanel(query: string, onSelect = vi.fn()) {
  const currentQuery = ref(query);
  const panel = shallowRef<ComposerPanelNavigationHandle>();
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(FileSearchPanel, {
        ref: panel,
        workspaceId: 1,
        query: currentQuery.value,
        onSelect,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, currentQuery, onSelect, panel };
}

async function flushSearch(): Promise<void> {
  await vi.advanceTimersByTimeAsync(120);
  await nextTick();
}

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  searchFiles.mockReset();
  vi.useRealTimers();
});

describe("FileSearchPanel", () => {
  it("renders and selects file and directory results", async () => {
    vi.useFakeTimers();
    const results: FileSearchItem[] = [
      { name: "components", relativePath: "src/components/", type: "directory" },
      { name: "main.ts", relativePath: "src/main.ts", type: "file" },
    ];
    searchFiles.mockResolvedValueOnce({ files: results });
    const mounted = mountPanel("src");

    await flushSearch();

    expect(searchFiles).toHaveBeenCalledWith({ workspaceId: 1, query: "src" });
    const directory = mounted.container.querySelector<HTMLButtonElement>(
      "[data-entry-type=directory]",
    )!;
    const file = mounted.container.querySelector<HTMLButtonElement>("[data-entry-type=file]")!;
    expect(directory.textContent).toContain("components");
    expect(directory.querySelector("[data-icon-type=directory]")).not.toBeNull();
    expect(file.querySelector("[data-icon-type=file]")).not.toBeNull();

    directory.click();
    expect(mounted.onSelect).toHaveBeenCalledWith(results[0]);
  });

  it("requests an empty query without changing it", async () => {
    vi.useFakeTimers();
    searchFiles.mockResolvedValueOnce({ files: [] });
    const mounted = mountPanel("");

    await flushSearch();

    expect(searchFiles).toHaveBeenCalledWith({ workspaceId: 1, query: "" });
    expect(mounted.container.textContent).toContain("没有匹配的文件或文件夹");
  });

  it("highlights, wraps, selects, and resets keyboard navigation", async () => {
    vi.useFakeTimers();
    const scrollIntoView = vi.fn();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
    const firstResults: FileSearchItem[] = [
      { name: "first.ts", relativePath: "src/first.ts", type: "file" },
      { name: "second.ts", relativePath: "src/second.ts", type: "file" },
    ];
    searchFiles.mockResolvedValueOnce({ files: firstResults }).mockResolvedValueOnce({
      files: [{ name: "next.ts", relativePath: "src/next.ts", type: "file" }],
    });
    const mounted = mountPanel("first");

    await flushSearch();

    const items = () => [
      ...mounted.container.querySelectorAll<HTMLElement>("[data-slot=file-search-item]"),
    ];
    expect(items()[0]?.dataset.active).toBe("true");
    expect(items()[0]?.getAttribute("aria-selected")).toBe("true");
    expect(
      mounted.container.querySelector("[role=listbox]")?.getAttribute("aria-activedescendant"),
    ).toBe(items()[0]?.id);

    mounted.panel.value?.handlePanelKeydown("ArrowUp");
    await nextTick();
    expect(items()[1]?.dataset.active).toBe("true");

    mounted.panel.value?.handlePanelKeydown("ArrowDown");
    await nextTick();
    expect(items()[0]?.dataset.active).toBe("true");

    items()[1]?.dispatchEvent(new MouseEvent("mouseenter"));
    await nextTick();
    mounted.panel.value?.handlePanelKeydown("Enter");
    expect(mounted.onSelect).toHaveBeenCalledWith(firstResults[1]);
    expect(scrollIntoView).toHaveBeenCalled();

    mounted.currentQuery.value = "next";
    await nextTick();
    await flushSearch();
    expect(items()).toHaveLength(1);
    expect(items()[0]?.dataset.active).toBe("true");
  });

  it("ignores keyboard navigation when there are no results", async () => {
    vi.useFakeTimers();
    searchFiles.mockResolvedValueOnce({ files: [] });
    const mounted = mountPanel("missing");

    await flushSearch();
    mounted.panel.value?.handlePanelKeydown("ArrowDown");
    mounted.panel.value?.handlePanelKeydown("Enter");

    expect(mounted.onSelect).not.toHaveBeenCalled();
    expect(mounted.container.querySelector("[role=listbox]")).toBeNull();
  });
});
