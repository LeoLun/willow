// @vitest-environment jsdom

import type { ToolApprovalEventPayload } from "@shared/api";
import { TOOL_APPROVAL_EVENT, TOOL_APPROVAL_RESOLVED_EVENT } from "@shared/constants";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick, ref, type App } from "vue";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  resolveToolApproval: vi.fn(),
  waitUntilReady: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
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

import {
  getToolApprovalRevision,
  hydrateToolApproval,
  useToolApproval,
  useToolApprovalListener,
} from "../src/renderer/src/composables/useToolApproval";

type ToolApproval = ReturnType<typeof useToolApproval>;

const mountedApps: App[] = [];

function createRequest(approvalId: string, sessionId = "session-a"): ToolApprovalEventPayload {
  return {
    approvalId,
    workspaceId: 1,
    sessionId,
    toolCallId: `call-${approvalId}`,
    toolName: "bash",
    input: { command: "pwd" },
    reason: "sandbox-denied",
    display: "pwd",
  };
}

function mountApproval() {
  const workspaceId = ref<number | undefined>(1);
  const sessionId = ref<string | undefined>("session-a");
  let approval!: ToolApproval;
  const app = createApp({
    setup() {
      useToolApprovalListener();
      approval = useToolApproval(workspaceId, sessionId);
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  mountedApps.push(app);
  return { approval, app, sessionId, workspaceId };
}

function getApprovalListener(): (payload: ToolApprovalEventPayload) => void {
  const listener = mocks.addEventListener.mock.calls.find(
    ([event]) => event === TOOL_APPROVAL_EVENT,
  )?.[1];
  if (!listener) throw new Error("tool approval listener was not registered");
  return listener;
}

function getApprovalResolvedListener(): (payload: {
  approvalId: string;
  workspaceId: number;
  sessionId: string;
}) => void {
  const listener = mocks.addEventListener.mock.calls.find(
    ([event]) => event === TOOL_APPROVAL_RESOLVED_EVENT,
  )?.[1];
  if (!listener) throw new Error("tool approval resolved listener was not registered");
  return listener;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveToolApproval.mockResolvedValue({ resolved: true });
  mocks.waitUntilReady.mockResolvedValue(undefined);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
});

describe("useToolApproval", () => {
  it("keeps an approval while another session is active and restores it on return", async () => {
    const mounted = mountApproval();
    const request = createRequest("approval-session-switch");
    getApprovalListener()(request);
    await nextTick();

    expect(mounted.approval.currentApproval.value).toBe(request);

    mounted.sessionId.value = "session-b";
    await nextTick();
    expect(mounted.approval.currentApproval.value).toBeUndefined();

    mounted.sessionId.value = "session-a";
    await nextTick();
    expect(mounted.approval.currentApproval.value).toBe(request);
  });

  it("matches both workspace and session", async () => {
    const mounted = mountApproval();
    getApprovalListener()(createRequest("approval-workspace"));
    await nextTick();

    mounted.workspaceId.value = 2;
    await nextTick();
    expect(mounted.approval.currentApproval.value).toBeUndefined();

    mounted.workspaceId.value = 1;
    await nextTick();
    expect(mounted.approval.currentApproval.value?.approvalId).toBe("approval-workspace");
  });

  it("resolves the selected decision and clears only the matching request", async () => {
    const mounted = mountApproval();
    const listener = getApprovalListener();
    const first = createRequest("approval-first");
    const second = createRequest("approval-second");
    listener(first);
    mocks.resolveToolApproval.mockImplementationOnce(async () => {
      listener(second);
      return { resolved: true };
    });

    await mounted.approval.resolveApproval(first.approvalId, "allow");

    expect(mocks.resolveToolApproval).toHaveBeenCalledWith({
      approvalId: first.approvalId,
      workspaceId: first.workspaceId,
      sessionId: first.sessionId,
      decision: "allow",
    });
    expect(mounted.approval.currentApproval.value).toBe(second);
  });

  it("hydrates an unresolved approval from session history", async () => {
    const mounted = mountApproval();
    const request = createRequest("approval-restored");
    const revision = getToolApprovalRevision(request.workspaceId, request.sessionId);

    expect(hydrateToolApproval(request.workspaceId, request.sessionId, request, revision)).toBe(
      true,
    );
    await nextTick();

    expect(mounted.approval.currentApproval.value).toBe(request);
  });

  it("does not let stale history clear a newer live approval", async () => {
    const mounted = mountApproval();
    const request = createRequest("approval-live");
    const historyRevision = getToolApprovalRevision(request.workspaceId, request.sessionId);

    getApprovalListener()(request);
    expect(
      hydrateToolApproval(request.workspaceId, request.sessionId, undefined, historyRevision),
    ).toBe(false);
    await nextTick();

    expect(mounted.approval.currentApproval.value).toBe(request);
  });

  it("clears a stale request when the main process no longer resolves it", async () => {
    const mounted = mountApproval();
    const request = createRequest("approval-stale");
    getApprovalListener()(request);
    mocks.resolveToolApproval.mockResolvedValueOnce({ resolved: false });

    await expect(
      mounted.approval.resolveApproval(request.approvalId, "deny"),
    ).resolves.toBeUndefined();
    expect(mounted.approval.currentApproval.value).toBeUndefined();
  });

  it("clears only the matching approval when the main process settles it", async () => {
    const mounted = mountApproval();
    const requested = getApprovalListener();
    const resolved = getApprovalResolvedListener();
    const first = createRequest("approval-settled-first");
    const second = createRequest("approval-settled-second");
    requested(first);
    requested(second);

    resolved({
      approvalId: first.approvalId,
      workspaceId: first.workspaceId,
      sessionId: first.sessionId,
    });
    expect(mounted.approval.currentApproval.value).toBe(second);

    resolved({
      approvalId: second.approvalId,
      workspaceId: second.workspaceId,
      sessionId: second.sessionId,
    });
    expect(mounted.approval.currentApproval.value).toBeUndefined();
  });

  it("removes the global event listener on unmount", () => {
    const mounted = mountApproval();
    const listener = getApprovalListener();

    mounted.app.unmount();

    expect(mocks.removeEventListener).toHaveBeenCalledWith(TOOL_APPROVAL_EVENT, listener);
    expect(mocks.removeEventListener).toHaveBeenCalledWith(
      TOOL_APPROVAL_RESOLVED_EVENT,
      expect.any(Function),
    );
  });
});
