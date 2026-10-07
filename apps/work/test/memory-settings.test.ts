// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, h, nextTick, type App } from "vue";
import type { MemoryFileRequest } from "../src/shared/api";

const mocks = vi.hoisted(() => ({
  readMemory: vi.fn(),
  openMemory: vi.fn(),
  saveMemory: vi.fn(),
  setMemoryEnabled: vi.fn(),
  getWorkspaceList: vi.fn(),
}));
vi.mock("@/lib/ipc", () => ({ electronAPI: mocks }));
vi.mock("vue-router", () => ({ useRoute: () => ({ query: { workspaceId: "2" } }) }));
vi.mock("@/components/message-list/blocks/MarkdownBlock.vue", async () => {
  const { defineComponent, h } = await import("vue");
  return {
    default: defineComponent({
      props: { content: String },
      setup: (props) => () => h("div", { "data-memory": "" }, props.content),
    }),
  };
});
import MemorySettings from "../src/renderer/src/components/dialog/setting/MemorySettings.vue";

const apps: App[] = [];
function mount() {
  const container = document.createElement("div");
  document.body.append(container);
  const app = createApp({ render: () => h(MemorySettings) });
  app.mount(container);
  apps.push(app);
  return container;
}
function button(container: HTMLElement, text: string, index = 0) {
  return [...container.querySelectorAll("button")].filter(
    (element) => element.textContent?.trim() === text,
  )[index]!;
}
function snapshot(request: MemoryFileRequest, content?: string) {
  const name = request.scope === "global" ? "global" : `project-${request.workspaceId}`;
  return {
    memory: {
      scope: request.scope,
      path: `/${name}/MEMORY.md`,
      exists: true,
      content: content ?? name,
      byteCount: 20,
      maxBytes: 16384,
      enabled: true,
    },
  };
}
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getWorkspaceList.mockImplementation(async ({ pinned }) => ({
    workspaces: pinned
      ? [{ id: 1, name: "First", path: "/first" }]
      : [{ id: 2, name: "Current", path: "/current" }],
  }));
  mocks.readMemory.mockImplementation(async (request) => snapshot(request));
  mocks.openMemory.mockResolvedValue({});
  mocks.setMemoryEnabled.mockImplementation(async (request) => request);
  mocks.saveMemory.mockImplementation(async (request) => snapshot(request, request.content));
});
afterEach(() => {
  for (const app of apps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("MemorySettings", () => {
  it("shows global and workspace-name tabs and edits the selected workspace", async () => {
    const container = mount();
    await vi.waitFor(() => expect(container.textContent).toContain("Current"));
    expect(container.textContent).toContain("global");
    button(container, "Current").click();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    container.querySelector<HTMLElement>('[role="button"]')!.click();
    await nextTick();
    const textarea = container.querySelector("textarea")!;
    textarea.value = "Updated";
    textarea.dispatchEvent(new Event("input"));
    await nextTick();
    button(container, "保存").click();
    await vi.waitFor(() =>
      expect(mocks.saveMemory).toHaveBeenCalledWith({
        scope: "project",
        workspaceId: 2,
        content: "Updated",
        expectedContent: "project-2",
      }),
    );
    await vi.waitFor(() => expect(container.querySelector("textarea")).toBeNull());
    expect(container.textContent).toContain("Updated");
    expect(mocks.openMemory).not.toHaveBeenCalled();
  });
  it("preserves drafts on focus and tab changes and cancels without saving", async () => {
    const container = mount();
    await vi.waitFor(() => expect(container.textContent).toContain("global"));
    container.querySelector<HTMLElement>('[role="button"]')!.click();
    await nextTick();
    const textarea = container.querySelector("textarea")!;
    textarea.value = "Draft";
    textarea.dispatchEvent(new Event("input"));
    window.dispatchEvent(new Event("focus"));
    await nextTick();
    button(container, "First").click();
    await nextTick();
    button(container, "全局记忆").click();
    await nextTick();
    expect(container.querySelector("textarea")!.value).toBe("Draft");
    button(container, "取消").click();
    await vi.waitFor(() => expect(container.querySelector("textarea")).toBeNull());
    expect(mocks.saveMemory).not.toHaveBeenCalled();
  });
  it("keeps the draft when saving fails", async () => {
    mocks.saveMemory.mockRejectedValue(new Error("记忆已被更新"));
    const container = mount();
    await vi.waitFor(() => expect(container.textContent).toContain("global"));
    container.querySelector<HTMLElement>('[role="button"]')!.click();
    await nextTick();
    button(container, "保存").click();
    await vi.waitFor(() => expect(container.textContent).toContain("记忆已被更新"));
    expect(container.querySelector("textarea")!.value).toBe("global");
  });
  it("does not show a stale response from another workspace", async () => {
    let resolveOld: (value: ReturnType<typeof snapshot>) => void = () => {};
    mocks.readMemory.mockImplementation((request) =>
      request.workspaceId === 1
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : Promise.resolve(snapshot(request)),
    );
    const container = mount();
    await vi.waitFor(() => expect(container.textContent).toContain("First"));
    button(container, "First").click();
    await nextTick();
    button(container, "Current").click();
    await vi.waitFor(() => expect(container.textContent).toContain("project-2"));
    resolveOld(snapshot({ scope: "project", workspaceId: 1 }, "STALE"));
    await nextTick();
    expect(container.textContent).not.toContain("STALE");
  });
});

it("shows an enabled switch and persists changes", async () => {
  const container = mount();
  await vi.waitFor(() =>
    expect(container.querySelector<HTMLButtonElement>('[role="switch"]')?.disabled).toBe(false),
  );
  const control = container.querySelector<HTMLButtonElement>('[role="switch"]')!;
  expect(control.getAttribute("aria-checked")).toBe("true");
  control.click();
  await vi.waitFor(() => expect(mocks.setMemoryEnabled).toHaveBeenCalledWith({ enabled: false }));
  await vi.waitFor(() => expect(control.getAttribute("aria-checked")).toBe("false"));
});
