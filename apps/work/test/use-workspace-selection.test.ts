// @vitest-environment jsdom

import type { WorkspaceInfo } from "@shared/api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "vue";

const mocks = vi.hoisted(() => ({
  getWorkspaceList: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  route: {
    name: "home" as string,
    query: {} as Record<string, string | undefined>,
  },
}));

vi.mock("@/lib/ipc", () => ({
  electronAPI: {
    getWorkspaceList: mocks.getWorkspaceList,
  },
}));

vi.mock("vue-router", async (importOriginal) => {
  const original = await importOriginal<typeof import("vue-router")>();
  return {
    ...original,
    useRoute: () => mocks.route,
    useRouter: () => ({ push: mocks.push, replace: mocks.replace }),
  };
});

import {
  LAST_WORKSPACE_ID_STORAGE_KEY,
  resolveWorkspaceId,
  useWorkspaceSelection,
} from "../src/renderer/src/composables/useWorkspaceSelection";
import { notifyWorkspaceCreated } from "../src/renderer/src/lib/app-state-events";

function workspace(id: number, createdAt: string, pinned = false): WorkspaceInfo {
  return {
    id,
    name: `Workspace ${id}`,
    path: `/workspace/${id}`,
    pinned,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

const oldest = workspace(1, "2026-07-20T00:00:00.000Z", true);
const newest = workspace(2, "2026-07-21T00:00:00.000Z");

function mockWorkspaceLoad(pinned = [oldest], unpinned = [newest]) {
  mocks.getWorkspaceList.mockImplementation(({ pinned: isPinned }: { pinned: boolean }) =>
    Promise.resolve({ workspaces: isPinned ? pinned : unpinned }),
  );
}

function mountComposable() {
  let selection: ReturnType<typeof useWorkspaceSelection> | undefined;
  const app = createApp({
    setup() {
      selection = useWorkspaceSelection();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  return {
    app,
    get selection() {
      if (!selection) throw new Error("useWorkspaceSelection was not initialized");
      return selection;
    },
  };
}

describe("resolveWorkspaceId", () => {
  it("prefers a valid query over the cached workspace", () => {
    expect(resolveWorkspaceId([oldest, newest], "1", 2)).toBe(1);
  });

  it("uses the cache only when the query is missing", () => {
    expect(resolveWorkspaceId([oldest, newest], undefined, 1)).toBe(1);
    expect(resolveWorkspaceId([oldest, newest], "99", 1)).toBe(2);
  });

  it("falls back to the last created workspace and uses the largest id for ties", () => {
    const tied = workspace(3, "2026-07-21T00:00:00.000Z", true);
    expect(resolveWorkspaceId([oldest, newest, tied], undefined, undefined)).toBe(3);
    expect(resolveWorkspaceId([], undefined, undefined)).toBeUndefined();
  });
});

describe("useWorkspaceSelection", () => {
  beforeEach(() => {
    localStorage.clear();
    mocks.route.name = "home";
    mocks.route.query = {};
    mocks.push.mockResolvedValue(undefined);
    mocks.replace.mockResolvedValue(undefined);
    mockWorkspaceLoad();
  });

  it("uses a valid query and records it as the latest selection", async () => {
    localStorage.setItem(LAST_WORKSPACE_ID_STORAGE_KEY, "2");
    mocks.route.query = { workspaceId: "1" };
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));
    expect(mounted.selection.selectedWorkspaceId.value).toBe(1);
    expect(localStorage.getItem(LAST_WORKSPACE_ID_STORAGE_KEY)).toBe("1");
    expect(mocks.replace).not.toHaveBeenCalled();
    mounted.app.unmount();
  });

  it("restores a valid cached workspace and fills the missing query", async () => {
    localStorage.setItem(LAST_WORKSPACE_ID_STORAGE_KEY, "1");
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));
    expect(mounted.selection.selectedWorkspaceId.value).toBe(1);
    expect(mocks.replace).toHaveBeenCalledWith({
      name: "home",
      query: { workspaceId: "1" },
    });
    mounted.app.unmount();
  });

  it("repairs an invalid query with the last created workspace", async () => {
    mocks.route.query = { workspaceId: "99", source: "sidebar" };
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));
    expect(mounted.selection.selectedWorkspaceId.value).toBe(2);
    expect(localStorage.getItem(LAST_WORKSPACE_ID_STORAGE_KEY)).toBe("2");
    expect(mocks.replace).toHaveBeenCalledWith({
      name: "home",
      query: { workspaceId: "2", source: "sidebar" },
    });
    mounted.app.unmount();
  });

  it("clears invalid selection state when there are no workspaces", async () => {
    localStorage.setItem(LAST_WORKSPACE_ID_STORAGE_KEY, "1");
    mocks.route.query = { workspaceId: "1" };
    mockWorkspaceLoad([], []);
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));
    expect(mounted.selection.selectedWorkspaceId.value).toBeUndefined();
    expect(localStorage.getItem(LAST_WORKSPACE_ID_STORAGE_KEY)).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith({ name: "home", query: {} });
    mounted.app.unmount();
  });

  it("stores a manual selection and pushes the updated query", async () => {
    mocks.route.query = { source: "sidebar" };
    const mounted = mountComposable();
    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));

    await mounted.selection.selectWorkspace("1");
    expect(localStorage.getItem(LAST_WORKSPACE_ID_STORAGE_KEY)).toBe("1");
    expect(mocks.push).toHaveBeenCalledWith({
      name: "home",
      query: { source: "sidebar", workspaceId: "1" },
    });
    mounted.app.unmount();
  });

  it("refreshes on open and falls back when the selected workspace was deleted", async () => {
    mocks.route.query = { workspaceId: "1" };
    const mounted = mountComposable();
    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));

    mockWorkspaceLoad([], [newest]);
    mounted.selection.handleWorkspaceSelectOpen(true);
    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));

    expect(mounted.selection.selectedWorkspaceId.value).toBe(2);
    expect(mocks.replace).toHaveBeenCalledWith({
      name: "home",
      query: { workspaceId: "2" },
    });
    mounted.app.unmount();
  });

  it("refreshes and selects a workspace created while the home page is mounted", async () => {
    mockWorkspaceLoad([], []);
    const mounted = mountComposable();
    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));

    mockWorkspaceLoad([], [newest]);
    notifyWorkspaceCreated(newest);

    await vi.waitFor(() => {
      expect(mounted.selection.selectedWorkspaceId.value).toBe(newest.id);
      expect(mocks.push).toHaveBeenCalledWith({
        name: "home",
        query: { workspaceId: String(newest.id) },
      });
    });
    mounted.app.unmount();
  });

  it("exposes initial loading failures and leaves sending without a workspace", async () => {
    mocks.getWorkspaceList.mockRejectedValueOnce(new Error("load failed"));
    const mounted = mountComposable();

    await vi.waitFor(() => expect(mounted.selection.loadingWorkspaces.value).toBe(false));
    expect(mounted.selection.workspaceLoadError.value).toBe("load failed");
    expect(mounted.selection.selectedWorkspaceId.value).toBeUndefined();
    mounted.app.unmount();
  });
});
