// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import type { ComposerPromptTemplate } from "../src/renderer/src/components/prompt-composer";
import type { SkillInfo, WorkspaceFilesChangedEvent } from "../src/shared/api";

const mocks = vi.hoisted(() => ({
  eventCallback: undefined as ((payload: WorkspaceFilesChangedEvent) => void) | undefined,
  getBoardPanel: vi.fn(),
  getSkillList: vi.fn(),
  removeEventListener: vi.fn(),
  setBoardEditMode: vi.fn(async () => ({ enabled: true })),
  subscribeWorkspaceFiles: vi.fn(async () => ({})),
  unsubscribeWorkspaceFiles: vi.fn(async () => ({})),
  waitUntilReady: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getBoardPanel: mocks.getBoardPanel,
    getSkillList: mocks.getSkillList,
    setBoardEditMode: mocks.setBoardEditMode,
    subscribeWorkspaceFiles: mocks.subscribeWorkspaceFiles,
    unsubscribeWorkspaceFiles: mocks.unsubscribeWorkspaceFiles,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: (_event: string, callback: (payload: WorkspaceFilesChangedEvent) => void) => {
      mocks.eventCallback = callback;
    },
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

import BoardPanel from "../src/renderer/src/components/right-sidebar/BoardPanel.vue";

const mountedApps: App[] = [];

function mountPanel(
  onSelectSkill = vi.fn<(skill: SkillInfo, template: ComposerPromptTemplate) => void>(),
  onInsertBoardNode = vi.fn<(source: string) => void>(),
) {
  const container = document.createElement("div");
  document.body.append(container);
  const Host = defineComponent({
    setup() {
      return () =>
        h(BoardPanel, {
          onInsertBoardNode,
          onSelectSkill,
          state: {},
          tabId: "board-tab",
          workspaceId: 1,
        });
    },
  });
  const app = createApp(Host);
  app.mount(container);
  mountedApps.push(app);
  return { container, onInsertBoardNode, onSelectSkill };
}

function dispatchEditorMessage(frame: HTMLIFrameElement, data: Record<string, unknown>): void {
  window.dispatchEvent(new MessageEvent("message", { data, source: frame.contentWindow }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventCallback = undefined;
  mocks.getBoardPanel.mockResolvedValue({ status: "missing" });
  mocks.getSkillList.mockResolvedValue({ skills: [] });
  mocks.setBoardEditMode.mockResolvedValue({ enabled: true });
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("BoardPanel", () => {
  it("shows the creation guide and emits the selected builtin skill", async () => {
    const skill: SkillInfo = {
      description: "Create a board",
      filePath: "/app/resources/skills/create-board/SKILL.md",
      name: "create-board",
      source: "builtin",
    };
    mocks.getSkillList.mockResolvedValue({ skills: [skill] });
    const { container, onSelectSkill } = mountPanel();

    const button = await vi.waitFor(() => {
      const candidate = [...container.querySelectorAll("button")].find((element) =>
        element.textContent?.includes("创建看板"),
      );
      expect(candidate).toBeDefined();
      return candidate as HTMLButtonElement;
    });
    button.click();

    await vi.waitFor(() =>
      expect(onSelectSkill).toHaveBeenCalledWith(skill, {
        segments: [
          {
            type: "text",
            content:
              "[!create-board](/app/resources/skills/create-board/SKILL.md) 分析当前项目的内容与结构，生成适合该项目的看板，并按照 ",
          },
          {
            type: "select",
            placeholder: "选择风格",
            options: [
              { label: "Airbnb", value: "Airbnb" },
              { label: "Cursor", value: "Cursor" },
              { label: "Claude", value: "Claude" },
              { label: "Apple", value: "Apple" },
            ],
          },
          {
            type: "text",
            content: " 风格完成布局与视觉设计。",
          },
        ],
      }),
    );
    expect(mocks.getSkillList).toHaveBeenCalledWith({ workspaceId: 1 });
  });

  it("loads the sandboxed iframe and reloads it after panel resources change", async () => {
    mocks.getBoardPanel.mockResolvedValue({
      status: "ready",
      url: "file:///workspace/.agents/panel/index.html",
    });
    const { container } = mountPanel();
    const firstFrame = await vi.waitFor(() => {
      const frame = container.querySelector<HTMLIFrameElement>("iframe");
      expect(frame).not.toBeNull();
      return frame!;
    });
    expect(firstFrame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
    expect(firstFrame.src).toContain("file:///workspace/.agents/panel/index.html?v=1");
    expect(firstFrame.src).toContain("willow-board-tab=board-tab");

    mocks.eventCallback?.({
      changes: [{ relativePath: ".agents/panel/styles.css", type: "change" }],
      workspaceId: 1,
    });

    await vi.waitFor(() => {
      const frame = container.querySelector<HTMLIFrameElement>("iframe");
      expect(frame).not.toBe(firstFrame);
      expect(frame?.src).toContain("?v=2");
    });
  });

  it("selects board content and emits multiple node references while edit mode stays active", async () => {
    mocks.getBoardPanel.mockResolvedValue({
      status: "ready",
      url: "file:///workspace/.agents/panel/index.html",
    });
    const { container, onInsertBoardNode } = mountPanel();
    const frame = await vi.waitFor(() => {
      const candidate = container.querySelector<HTMLIFrameElement>("iframe");
      expect(candidate).not.toBeNull();
      return candidate!;
    });
    container.querySelector<HTMLButtonElement>("[data-slot=board-edit-toggle]")!.click();
    await vi.waitFor(() =>
      expect(mocks.setBoardEditMode).toHaveBeenCalledWith({
        enabled: true,
        tabId: "board-tab",
        workspaceId: 1,
      }),
    );
    expect(frame.getAttribute("sandbox")).toBe("allow-scripts allow-same-origin");
    Object.defineProperties(frame, {
      clientHeight: { configurable: true, value: 600 },
      clientWidth: { configurable: true, value: 400 },
    });
    dispatchEditorMessage(frame, {
      channel: "willow-board-editor",
      rect: { right: 300, top: 20 },
      reference: {
        label: "status",
        path: ".agents/panel/index.html",
        selector: '[data-board-node="status"]',
        summary: "Project status",
        tag: "section",
      },
      tabId: "board-tab",
      type: "selected",
    });
    await nextTick();

    const addButton = container.querySelector<HTMLButtonElement>("[data-slot=board-add-node]")!;
    expect(addButton.style.left).toBe("296px");
    expect(addButton.style.top).toBe("24px");
    addButton.click();
    await nextTick();
    expect(onInsertBoardNode).toHaveBeenCalledWith(
      '<board-node path=".agents/panel/index.html" selector="[data-board-node=&quot;status&quot;]" tag="section" label="status">Project status</board-node>',
    );
    expect(container.querySelector("[data-slot=board-edit-toggle]")?.textContent).toContain(
      "退出编辑",
    );
    expect(container.querySelector("[data-slot=board-add-node]")).toBeNull();

    dispatchEditorMessage(frame, {
      channel: "willow-board-editor",
      rect: { right: 280, top: 120 },
      reference: {
        label: "risks",
        path: ".agents/panel/index.html",
        selector: "#risks",
        summary: "Current risks",
        tag: "article",
      },
      tabId: "board-tab",
      type: "selected",
    });
    await nextTick();
    container.querySelector<HTMLButtonElement>("[data-slot=board-add-node]")!.click();
    expect(onInsertBoardNode).toHaveBeenCalledTimes(2);
  });

  it("cleans selection and exits edit mode with Escape", async () => {
    mocks.getBoardPanel.mockResolvedValue({
      status: "ready",
      url: "file:///workspace/.agents/panel/index.html",
    });
    const { container } = mountPanel();
    const frame = await vi.waitFor(() => {
      const candidate = container.querySelector<HTMLIFrameElement>("iframe");
      expect(candidate).not.toBeNull();
      return candidate!;
    });
    container.querySelector<HTMLButtonElement>("[data-slot=board-edit-toggle]")!.click();
    await vi.waitFor(() => expect(mocks.setBoardEditMode).toHaveBeenCalledTimes(1));
    dispatchEditorMessage(frame, {
      channel: "willow-board-editor",
      tabId: "board-tab",
      type: "exit",
    });
    await nextTick();

    expect(container.querySelector("[data-slot=board-add-node]")).toBeNull();
    expect(container.querySelector("[data-slot=board-edit-toggle]")?.textContent).toContain("编辑");
    await vi.waitFor(() =>
      expect(mocks.setBoardEditMode).toHaveBeenLastCalledWith({
        enabled: false,
        tabId: "board-tab",
        workspaceId: 1,
      }),
    );
  });

  it("shows an error and keeps the original iframe when editor injection fails", async () => {
    mocks.getBoardPanel.mockResolvedValue({
      status: "ready",
      url: "file:///workspace/.agents/panel/index.html",
    });
    mocks.setBoardEditMode.mockRejectedValueOnce(new Error("无法访问看板文档"));
    const { container } = mountPanel();
    const frame = await vi.waitFor(() => {
      const candidate = container.querySelector<HTMLIFrameElement>("iframe");
      expect(candidate).not.toBeNull();
      return candidate!;
    });
    container.querySelector<HTMLButtonElement>("[data-slot=board-edit-toggle]")!.click();
    await vi.waitFor(() =>
      expect(container.querySelector("[role=alert]")?.textContent).toContain("无法访问看板文档"),
    );
    expect(container.querySelector("[data-slot=board-edit-toggle]")?.textContent).toContain("编辑");
    expect(container.querySelector("iframe")).toBe(frame);
    expect(frame.getAttribute("src")).toContain("index.html?v=1");
  });

  it("switches from the guide to the iframe when index.html is created", async () => {
    const { container } = mountPanel();
    await vi.waitFor(() => expect(container.textContent).toContain("当前项目还没有看板"));
    mocks.getBoardPanel.mockResolvedValueOnce({
      status: "ready",
      url: "file:///workspace/.agents/panel/index.html",
    });

    mocks.eventCallback?.({
      changes: [{ relativePath: ".agents/panel/index.html", type: "add" }],
      workspaceId: 1,
    });

    await vi.waitFor(() => expect(container.querySelector("iframe")).not.toBeNull());
  });

  it("shows load and disabled-skill errors and cleans up its subscription", async () => {
    mocks.getBoardPanel.mockRejectedValueOnce(new Error("read failed"));
    const { container } = mountPanel();
    await vi.waitFor(() => expect(container.textContent).toContain("read failed"));

    mocks.getBoardPanel.mockResolvedValueOnce({ status: "missing" });
    [...container.querySelectorAll("button")]
      .find((element) => element.textContent?.includes("重新检查"))
      ?.click();
    await vi.waitFor(() => expect(container.textContent).toContain("当前项目还没有看板"));
    [...container.querySelectorAll("button")]
      .find((element) => element.textContent?.includes("创建看板"))
      ?.click();
    await vi.waitFor(() => expect(container.textContent).toContain("技能不可用"));

    mountedApps.pop()?.unmount();
    await nextTick();
    expect(mocks.removeEventListener).toHaveBeenCalled();
    expect(mocks.unsubscribeWorkspaceFiles).toHaveBeenCalledWith({
      subscriptionId: "board-tab",
    });
  });
});
