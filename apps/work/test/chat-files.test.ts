// @vitest-environment jsdom

import type { FileSearchItem } from "@shared/api";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getProviderCatalog: vi.fn(),
  getSessionList: vi.fn(),
  getMessageList: vi.fn(),
  getSkillList: vi.fn(),
  getUserConfig: vi.fn(),
  removeEventListener: vi.fn(),
  resolveToolApproval: vi.fn(),
  searchFiles: vi.fn(),
  selectLocalFiles: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getConfiguredProviders: mocks.getConfiguredProviders,
    getProviderCatalog: mocks.getProviderCatalog,
    getSessionList: mocks.getSessionList,
    getMessageList: mocks.getMessageList,
    getSkillList: mocks.getSkillList,
    getUserConfig: mocks.getUserConfig,
    resolveToolApproval: mocks.resolveToolApproval,
    searchFiles: mocks.searchFiles,
    selectLocalFiles: mocks.selectLocalFiles,
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
  default: {
    setup(_: unknown, { slots }: { slots: { left?: () => unknown } }) {
      return () => slots.left?.();
    },
  },
}));

import { useDialog } from "../src/renderer/src/components/dialog";
import SettingDialog from "../src/renderer/src/components/dialog/setting/Setting.vue";
import { notifyProviderConfigurationChanged } from "../src/renderer/src/lib/app-state-events";
import ChatBase from "../src/renderer/src/pages/main/ChatBase.vue";

const mountedApps: App[] = [];
const ChatSlot = defineComponent({
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
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

function enterMentionQuery(container: HTMLElement, query: string): void {
  const editor = container.querySelector<HTMLElement>("[data-slot=prompt-editor]");
  if (!editor) throw new Error("prompt editor was not rendered");
  const source = `@${query}`;
  editor.replaceChildren(document.createTextNode(source));
  editor.focus();
  const range = document.createRange();
  range.setStart(editor.firstChild!, source.length);
  range.collapse(true);
  const selection = window.getSelection();
  selection?.removeAllRanges();
  selection?.addRange(range);
  editor.dispatchEvent(new InputEvent("input", { bubbles: true, data: source }));
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getSessionList.mockResolvedValue({ sessions: [] });
  mocks.getMessageList.mockResolvedValue({ messages: [] });
  mocks.getSkillList.mockResolvedValue({ skills: [] });
  mocks.getUserConfig.mockResolvedValue({});
  mocks.resolveToolApproval.mockResolvedValue({ resolved: true });
  mocks.searchFiles.mockResolvedValue({ files: [] });
  mocks.selectLocalFiles.mockResolvedValue({ files: [] });
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("ChatBase file search", () => {
  it("opens settings on the providers tab from the empty model state", async () => {
    const container = await mountChatBase();
    await vi.waitFor(() => expect(container.textContent).toContain("请先连接模型提供商"));

    const settingsButton = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent?.trim() === "前往设置",
    );
    expect(settingsButton).toBeDefined();
    settingsButton?.click();

    const { dialogState } = useDialog();
    expect(dialogState.value?.component).toBe(SettingDialog);
    expect(dialogState.value?.props).toMatchObject({ initialTab: "providers" });
    expect(dialogState.value?.open).toBe(true);
  });

  it("refreshes and selects the first model after a provider is connected", async () => {
    const container = await mountChatBase();
    await vi.waitFor(() => expect(mocks.getConfiguredProviders).toHaveBeenCalledTimes(1));

    mocks.getConfiguredProviders.mockResolvedValue({ providerIds: ["openai"] });
    mocks.getProviderCatalog.mockResolvedValue({
      providers: [
        {
          id: "openai",
          name: "OpenAI",
          apiKeyLabel: "API key",
          models: [{ id: "gpt-5", name: "GPT-5", thinkingLevels: [] }],
        },
      ],
    });
    notifyProviderConfigurationChanged();

    await vi.waitFor(() => {
      expect(mocks.getConfiguredProviders).toHaveBeenCalledTimes(2);
      expect(container.textContent).toContain("GPT-5");
    });
  });

  it("opens the local file selector from the add button", async () => {
    const container = await mountChatBase();
    container.querySelector<HTMLButtonElement>('[aria-label="添加内容或选择模式"]')?.click();
    const fileButton = await vi.waitFor(() => {
      const popover = [...document.body.querySelectorAll<HTMLParagraphElement>("p")].find(
        (candidate) => candidate.textContent?.trim() === "模式",
      )?.parentElement;
      const button = [...(popover?.querySelectorAll<HTMLButtonElement>("button") ?? [])].find(
        (candidate) => candidate.textContent?.trim() === "文件",
      );
      expect(button).toBeDefined();
      return button as HTMLButtonElement;
    });
    fileButton.click();

    await vi.waitFor(() => {
      expect(mocks.selectLocalFiles).toHaveBeenCalledOnce();
    });
  });

  it("searches and inserts a workspace-relative file token", async () => {
    mocks.searchFiles.mockResolvedValueOnce({
      files: [
        {
          name: "ChatBase.vue",
          relativePath: "apps/work/src/pages/ChatBase.vue",
          type: "file",
        },
      ],
    });
    const container = await mountChatBase();
    enterMentionQuery(container, "chat");

    await vi.waitFor(() => {
      expect(mocks.searchFiles).toHaveBeenCalledWith({
        workspaceId: 1,
        query: "chat",
      });
      expect(container.querySelectorAll("[data-slot=file-search-item]")).toHaveLength(1);
    });

    container
      .querySelector<HTMLElement>("[data-slot=prompt-editor]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => {
      expect(
        container.querySelector(
          '[data-token-source="[ChatBase.vue](<apps/work/src/pages/ChatBase.vue>)"]',
        ),
      ).not.toBeNull();
    });
  });

  it("searches and inserts a workspace-relative directory token with a trailing slash", async () => {
    mocks.searchFiles.mockResolvedValueOnce({
      files: [
        {
          name: "components",
          relativePath: "apps/work/src/components/",
          type: "directory",
        },
      ],
    });
    const container = await mountChatBase();
    enterMentionQuery(container, "components");

    await vi.waitFor(() => {
      expect(mocks.searchFiles).toHaveBeenCalledWith({
        workspaceId: 1,
        query: "components",
      });
      expect(
        container.querySelector("[data-entry-type=directory] [data-icon-type=directory]"),
      ).not.toBeNull();
    });

    container
      .querySelector<HTMLElement>("[data-slot=prompt-editor]")
      ?.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    await vi.waitFor(() => {
      expect(
        container.querySelector('[data-token-source="[components](<apps/work/src/components/>)"]'),
      ).not.toBeNull();
    });
  });

  it("hides the relative path for root files and keeps it for nested files", async () => {
    mocks.searchFiles.mockResolvedValueOnce({
      files: [
        { name: "README.md", relativePath: "README.md", type: "file" },
        { name: "guide.md", relativePath: "docs/guide.md", type: "file" },
      ],
    });
    const container = await mountChatBase();
    enterMentionQuery(container, "md");

    await vi.waitFor(() => {
      expect(container.querySelectorAll("[data-slot=file-search-item]")).toHaveLength(2);
    });

    const items = container.querySelectorAll("[data-slot=file-search-item]");
    expect(items[0]?.querySelector("[data-slot=file-search-path]")).toBeNull();
    expect(items[1]?.querySelector("[data-slot=file-search-path]")?.textContent).toContain(
      "docs/guide.md",
    );
  });

  it("discards stale search results and shows empty and error states", async () => {
    const first = deferred<{ files: FileSearchItem[] }>();
    const second = deferred<{ files: FileSearchItem[] }>();
    mocks.searchFiles.mockImplementation(({ query }: { query: string }) => {
      if (query === "first") return first.promise;
      if (query === "second") return second.promise;
      return Promise.resolve({ files: [] });
    });
    const container = await mountChatBase();

    enterMentionQuery(container, "first");
    await vi.waitFor(() =>
      expect(mocks.searchFiles).toHaveBeenCalledWith({
        workspaceId: 1,
        query: "first",
      }),
    );
    enterMentionQuery(container, "second");
    await vi.waitFor(() =>
      expect(mocks.searchFiles).toHaveBeenCalledWith({
        workspaceId: 1,
        query: "second",
      }),
    );

    second.resolve({
      files: [{ name: "second.ts", relativePath: "second.ts", type: "file" }],
    });
    await vi.waitFor(() => expect(container.textContent).toContain("second.ts"));
    first.resolve({
      files: [{ name: "first.ts", relativePath: "first.ts", type: "file" }],
    });
    await nextTick();
    expect(container.textContent).not.toContain("first.ts");

    enterMentionQuery(container, "empty");
    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=file-search-empty]")).not.toBeNull(),
    );

    mocks.searchFiles.mockRejectedValueOnce(new Error("scan failed"));
    enterMentionQuery(container, "broken");
    await vi.waitFor(() =>
      expect(container.querySelector("[data-slot=file-search-error]")).not.toBeNull(),
    );
  });
});
