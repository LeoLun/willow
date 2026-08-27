// @vitest-environment jsdom

import type { ToolApprovalEventPayload } from "@shared/api";
import { TOOL_APPROVAL_EVENT } from "@shared/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, defineComponent, h, nextTick, type App } from "vue";
import { createMemoryHistory, createRouter, RouterView } from "vue-router";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getConfiguredProviders: vi.fn(),
  getProviderCatalog: vi.fn(),
  getMessageList: vi.fn(),
  getSessionList: vi.fn(),
  getSkillList: vi.fn(),
  getUserConfig: vi.fn(),
  removeEventListener: vi.fn(),
  resolveToolApproval: vi.fn(),
  setPermissionMode: vi.fn(async (request) => request),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getConfiguredProviders: mocks.getConfiguredProviders,
    getProviderCatalog: mocks.getProviderCatalog,
    getMessageList: mocks.getMessageList,
    getSessionList: mocks.getSessionList,
    getSkillList: mocks.getSkillList,
    getUserConfig: mocks.getUserConfig,
    resolveToolApproval: mocks.resolveToolApproval,
    setPermissionMode: mocks.setPermissionMode,
  },
}));

vi.mock("@/components/layout/BaseHeader.vue", () => ({
  default: {
    setup(_: unknown, { slots }: { slots: { left?: () => unknown; right?: () => unknown } }) {
      return () => [slots.left?.(), slots.right?.()];
    },
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
    waitUntilReady: mocks.waitUntilReady,
  }),
}));

import { useToolApprovalListener } from "../src/renderer/src/composables/useToolApproval";
import ChatBase from "../src/renderer/src/pages/main/ChatBase.vue";

const mountedApps: App[] = [];
let persistedApproval: ToolApprovalEventPayload | undefined;

const ChatSlot = defineComponent({
  setup(_, { slots }) {
    return () => h("div", { "data-slot": "chat-test-slot" }, slots.default?.());
  },
});

function createRequest(): ToolApprovalEventPayload {
  return {
    approvalId: "approval-chat-route",
    workspaceId: 1,
    sessionId: "session-a",
    toolCallId: "call-chat-route",
    toolName: "bash",
    input: { command: "mv source target" },
    reason: "sandbox-denied",
    display: "mv source target",
  };
}

function getApprovalListener(): (payload: ToolApprovalEventPayload) => void {
  const listener = mocks.addEventListener.mock.calls.find(
    ([event]) => event === TOOL_APPROVAL_EVENT,
  )?.[1];
  if (!listener) throw new Error("tool approval listener was not registered");
  return listener;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getConfiguredProviders.mockResolvedValue({ providerIds: [] });
  mocks.getProviderCatalog.mockResolvedValue({ providers: [] });
  persistedApproval = undefined;
  mocks.getMessageList.mockImplementation(async (request: { sessionId: string }) => ({
    messages: [],
    artifacts: [],
    pendingToolApproval: request.sessionId === "session-a" ? persistedApproval : undefined,
  }));
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

describe("ChatBase approval panel", () => {
  it("replaces only the requesting session composer and restores the panel on return", async () => {
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
    const app = createApp({
      setup() {
        useToolApprovalListener();
        return () => h(RouterView);
      },
    });
    app.use(router);
    app.mount(container);
    mountedApps.push(app);
    await nextTick();

    await vi.waitFor(() =>
      expect(mocks.setPermissionMode).toHaveBeenCalledWith({
        workspaceId: 1,
        sessionId: "session-a",
        permissionMode: "request-approval",
      }),
    );

    expect(container.querySelector("[data-slot=prompt-editor]")).not.toBeNull();
    expect(container.querySelector("[data-slot=tool-approval-panel]")).toBeNull();

    persistedApproval = createRequest();
    getApprovalListener()(persistedApproval);
    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=prompt-editor]")).toBeNull();
      expect(container.querySelector("[data-slot=tool-approval-panel]")).not.toBeNull();
    });

    await router.push("/chat/session-b?workspaceId=1");
    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=prompt-editor]")).not.toBeNull();
      expect(container.querySelector("[data-slot=tool-approval-panel]")).toBeNull();
    });
    expect(mocks.setPermissionMode).toHaveBeenCalledWith({
      workspaceId: 1,
      sessionId: "session-b",
      permissionMode: "request-approval",
    });

    await router.push("/chat/session-a?workspaceId=1");
    await vi.waitFor(() => {
      expect(container.querySelector("[data-slot=prompt-editor]")).toBeNull();
      expect(container.querySelector("[data-slot=tool-approval-panel]")).not.toBeNull();
    });
  });
});
