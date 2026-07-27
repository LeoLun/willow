// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getProviderCatalog: vi.fn(),
  getSessionList: vi.fn(),
  getSkillList: vi.fn(),
  getUserConfig: vi.fn(),
  removeEventListener: vi.fn(),
  resolveToolApproval: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getConfiguredProviders: mocks.getConfiguredProviders,
    getProviderCatalog: mocks.getProviderCatalog,
    getSessionList: mocks.getSessionList,
    getSkillList: mocks.getSkillList,
    getUserConfig: mocks.getUserConfig,
    resolveToolApproval: mocks.resolveToolApproval,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

import ChatBase from "../src/renderer/src/pages/main/ChatBase.vue";

const mountedApps: App[] = [];
const ChatSlot = defineComponent({
  setup(_, { slots }) {
    return () => h("div", slots.default?.());
  },
});

async function mountChatBase() {
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

function enterSlashQuery(container: HTMLElement, query: string) {
  const editor = container.querySelector<HTMLElement>("[data-slot=prompt-editor]");
  if (!editor) throw new Error("prompt editor was not rendered");
  const source = `/${query}`;
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

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getSessionList.mockResolvedValue({ sessions: [] });
  mocks.getSkillList.mockResolvedValue({ skills: [] });
  mocks.getUserConfig.mockResolvedValue({});
  mocks.resolveToolApproval.mockResolvedValue({ resolved: true });
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
});

describe("ChatBase skills", () => {
  it("filters real skills by description and inserts the selected skill path", async () => {
    const reviewPath = "/workspace/.willow/skills/review/SKILL.md";
    mocks.getSkillList.mockResolvedValueOnce({
      skills: [
        {
          name: "review",
          description: "Inspect pull request changes",
          filePath: reviewPath,
        },
        {
          name: "write-docs",
          description: "Create documentation",
          filePath: "/workspace/.willow/skills/write-docs/SKILL.md",
        },
      ],
    });
    const container = await mountChatBase();
    enterSlashQuery(container, "pull");
    await vi.waitFor(() => expect(mocks.getSkillList).toHaveBeenCalledWith({ workspaceId: 1 }));

    await vi.waitFor(() => {
      const items = container.querySelectorAll("[data-slot=skill-list-item]");
      expect(items).toHaveLength(1);
      expect(items[0]?.textContent).toContain("review");
    });

    container.querySelector<HTMLButtonElement>("[data-slot=skill-list-item]")?.click();
    await vi.waitFor(() => {
      expect(
        container.querySelector(`[data-token-source="[!review](${reviewPath})"]`),
      ).not.toBeNull();
    });
  });

  it("shows empty and load-error states", async () => {
    const emptyContainer = await mountChatBase();
    enterSlashQuery(emptyContainer, "");
    await vi.waitFor(() => {
      expect(emptyContainer.querySelector("[data-slot=skill-list-empty]")).not.toBeNull();
    });

    mountedApps.pop()?.unmount();
    emptyContainer.remove();
    mocks.getSkillList.mockRejectedValueOnce(new Error("scan failed"));
    const errorContainer = await mountChatBase();
    enterSlashQuery(errorContainer, "");
    await vi.waitFor(() => {
      expect(errorContainer.querySelector("[data-slot=skill-list-error]")).not.toBeNull();
    });
  });
});
