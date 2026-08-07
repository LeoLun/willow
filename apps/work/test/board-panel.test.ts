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
  subscribeWorkspaceFiles: vi.fn(async () => ({})),
  unsubscribeWorkspaceFiles: vi.fn(async () => ({})),
  waitUntilReady: vi.fn(async () => undefined),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getBoardPanel: mocks.getBoardPanel,
    getSkillList: mocks.getSkillList,
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
) {
  const container = document.createElement("div");
  document.body.append(container);
  const Host = defineComponent({
    setup() {
      return () =>
        h(BoardPanel, {
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
  return { container, onSelectSkill };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.eventCallback = undefined;
  mocks.getBoardPanel.mockResolvedValue({ status: "missing" });
  mocks.getSkillList.mockResolvedValue({ skills: [] });
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
              "[!create-board](/app/resources/skills/create-board/SKILL.md) 参考当前项目生成适应的看板， 风格参考 ",
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
