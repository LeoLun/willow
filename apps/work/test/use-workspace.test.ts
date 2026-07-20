// @vitest-environment jsdom

import type { MessageEventPayload, WorkspaceInfo } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  addEventListener: vi.fn(),
  getSessionList: vi.fn(),
  getWorkspaceList: vi.fn(),
  removeEventListener: vi.fn(),
  setWorkspacePinned: vi.fn(),
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getSessionList: mocks.getSessionList,
    getWorkspaceList: mocks.getWorkspaceList,
    setWorkspacePinned: mocks.setWorkspacePinned,
  },
}));

vi.mock("@/composables/useEventBus", () => ({
  useEventBus: () => ({
    addEventListener: mocks.addEventListener,
    removeEventListener: mocks.removeEventListener,
  }),
}));

import { useWorkspace } from "../src/renderer/src/composables/useWorkspace";

const pinnedWorkspace: WorkspaceInfo = {
  id: 1,
  name: "Pinned",
  path: "/workspace/pinned",
  pinned: true,
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
};
const unpinnedWorkspace: WorkspaceInfo = {
  id: 2,
  name: "Unpinned",
  path: "/workspace/unpinned",
  pinned: false,
  createdAt: new Date("2026-07-20T00:00:00.000Z"),
  updatedAt: new Date("2026-07-20T00:00:00.000Z"),
};

function mockWorkspaceLoad() {
  mocks.getWorkspaceList.mockImplementation(({ pinned }: { pinned: boolean }) =>
    Promise.resolve({ workspaces: pinned ? [pinnedWorkspace] : [unpinnedWorkspace] }),
  );
  mocks.getSessionList.mockImplementation(({ workspaceId }: { workspaceId: number }) =>
    Promise.resolve({
      sessions: [
        {
          id: `session-${workspaceId}`,
          workspaceId,
          title: `Session ${workspaceId}`,
          createdAt: "2026-07-20T00:00:00.000Z",
        },
      ],
    }),
  );
}

function mountComposable() {
  let workspace: ReturnType<typeof useWorkspace> | undefined;
  const app = createApp({
    setup() {
      workspace = useWorkspace();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  return {
    app,
    get workspace() {
      if (!workspace) throw new Error("useWorkspace was not initialized");
      return workspace;
    },
  };
}

describe("useWorkspace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads workspaces with their sessions and updates titles from events", async () => {
    mockWorkspaceLoad();
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.workspace.loading.value).toBe(false));
    expect(mocks.getSessionList).toHaveBeenCalledTimes(2);
    expect(mounted.workspace.pinnedWorkspaces.value).toEqual([
      { ...pinnedWorkspace, sessions: [expect.objectContaining({ id: "session-1" })] },
    ]);
    expect(mounted.workspace.unpinnedWorkspaces.value).toEqual([
      { ...unpinnedWorkspace, sessions: [expect.objectContaining({ id: "session-2" })] },
    ]);

    const titleListener = mocks.addEventListener.mock.calls.find(
      ([event]) => event === MESSAGE_EVENT,
    )?.[1] as ((payload: MessageEventPayload) => void) | undefined;
    titleListener?.({ type: "title_updated", sessionId: "session-1", title: "Renamed" });
    await nextTick();

    expect(mounted.workspace.pinnedWorkspaces.value[0]?.sessions[0]?.title).toBe("Renamed");
    mounted.app.unmount();
    expect(mocks.removeEventListener).toHaveBeenCalledWith(MESSAGE_EVENT, titleListener);
  });

  it("refreshes one workspace session list and reloads after pinning", async () => {
    mockWorkspaceLoad();
    mocks.setWorkspacePinned.mockResolvedValue({ workspace: pinnedWorkspace });
    const mounted = mountComposable();
    await vi.waitFor(() => expect(mounted.workspace.loading.value).toBe(false));

    mocks.getSessionList.mockResolvedValueOnce({
      sessions: [
        {
          id: "new-session",
          workspaceId: 1,
          title: "New session",
          createdAt: "2026-07-20T01:00:00.000Z",
        },
      ],
    });
    await mounted.workspace.loadWorkspaceSessions(1);
    expect(mounted.workspace.pinnedWorkspaces.value[0]?.sessions[0]?.id).toBe("new-session");

    mockWorkspaceLoad();
    await mounted.workspace.setWorkspacePinned(unpinnedWorkspace);
    expect(mocks.setWorkspacePinned).toHaveBeenCalledWith({ workspaceId: 2, pinned: true });
    expect(mocks.getWorkspaceList).toHaveBeenCalledTimes(4);
    mounted.app.unmount();
  });

  it("exposes workspace loading failures for retry", async () => {
    mocks.getWorkspaceList.mockRejectedValueOnce(new Error("load failed"));
    mocks.getWorkspaceList.mockResolvedValueOnce({ workspaces: [] });
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.workspace.loading.value).toBe(false));
    expect(mounted.workspace.workspaceError.value).toBe("load failed");
    expect(mounted.workspace.pinnedWorkspaces.value).toEqual([]);
    expect(mounted.workspace.unpinnedWorkspaces.value).toEqual([]);
    mounted.app.unmount();
  });
});
