// @vitest-environment jsdom

import type { FileSearchItem } from "@shared/api";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";

const searchFiles = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ipc", () => ({
  electronAPI: { searchFiles },
}));

import FileSearchPanel from "../src/renderer/src/components/prompt-composer/FileSearchPanel.vue";

const mountedApps: App[] = [];

function mountPanel(query: string, onSelect = vi.fn()) {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({
    render: () =>
      h(FileSearchPanel, {
        workspaceId: 1,
        query,
        onSelect,
      }),
  });
  app.mount(container);
  mountedApps.push(app);
  return { container, onSelect };
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
});
