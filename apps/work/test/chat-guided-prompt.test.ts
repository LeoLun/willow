// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getProviderCatalog: vi.fn(),
  getSessionList: vi.fn(),
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

vi.mock("@/components/layout/BaseHeader.vue", () => ({
  default: {
    setup(_: unknown, { slots }: { slots: { left?: () => unknown } }) {
      return () => slots.left?.();
    },
  },
}));

import { consumeGuidedPrompt, requestGuidedPrompt } from "../src/renderer/src/lib/app-state-events";
import { GUIDED_AUTOMATION_TEMPLATE } from "../src/renderer/src/lib/automation-guide";
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
        children: [{ path: "", name: "home", component: ChatSlot }],
      },
    ],
  });
  await router.push("/");
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

function promptEditor(container: HTMLElement): HTMLElement | null {
  return container.querySelector("[data-slot=prompt-editor]");
}

beforeEach(() => {
  vi.clearAllMocks();
  consumeGuidedPrompt();
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  mocks.getSessionList.mockResolvedValue({ sessions: [] });
  mocks.getUserConfig.mockResolvedValue({});
  mocks.resolveToolApproval.mockResolvedValue({ resolved: true });
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.replaceChildren();
  consumeGuidedPrompt();
});

describe("ChatBase guided automation prompt", () => {
  it("loads the guided automation template when a request is pending", async () => {
    requestGuidedPrompt(GUIDED_AUTOMATION_TEMPLATE);
    const container = await mountChatBase();

    await vi.waitFor(() => {
      const editor = promptEditor(container);
      expect(editor?.querySelector("[data-template-control]")).not.toBeNull();
      expect(editor?.textContent).toContain("请帮我创建一个定时自动化任务");
      expect(editor?.textContent).toContain("任务内容：");
      expect(editor?.textContent).toContain("选择执行频率");
    });

    expect(consumeGuidedPrompt()).toBeUndefined();
  });

  it("leaves the composer empty when no request is pending", async () => {
    const container = await mountChatBase();
    await nextTick();
    await nextTick();

    const editor = promptEditor(container);
    expect(editor?.querySelector("[data-template-control]")).toBeNull();
    expect(editor?.textContent?.trim() ?? "").toBe("");
  });
});
