import type { MessageEventPayload, SessionInfo, WorkspaceInfo } from "@shared/api";
import { MESSAGE_EVENT } from "@shared/constants";
import { onBeforeUnmount, onMounted, ref, shallowRef } from "vue";
import { electronAPI } from "@/lib/ipc";
import { useEventBus } from "./useEventBus";
import { useMessageStatus } from "./useMessage";

type UpdateSessionPayload = {
  sessionId: SessionInfo["id"];
} & Partial<SessionInfo>;

export interface WorkspaceWithSessions extends WorkspaceInfo {
  sessions: SessionInfo[];
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

export function useWorkspace() {
  const { addEventListener, removeEventListener } = useEventBus();
  const { isSessionRunning } = useMessageStatus();
  const pinnedWorkspaces = shallowRef<WorkspaceWithSessions[]>([]);
  const unpinnedWorkspaces = shallowRef<WorkspaceWithSessions[]>([]);
  const loading = ref(false);
  const workspaceError = ref("");
  const updatingWorkspaceId = ref<number>();

  function withExecutionStatus(sessions: SessionInfo[]): SessionInfo[] {
    return sessions.map((session) =>
      isSessionRunning(session.id) ? { ...session, status: "started" } : session,
    );
  }

  async function withSessions(workspace: WorkspaceInfo): Promise<WorkspaceWithSessions> {
    const response = await electronAPI.getSessionList({
      workspaceId: workspace.id,
    });
    return { ...workspace, sessions: withExecutionStatus(response.sessions) };
  }

  function replaceWorkspaceSessions(workspaceId: number, sessions: SessionInfo[]) {
    const replace = (workspaces: WorkspaceWithSessions[]) =>
      workspaces.map((workspace) =>
        workspace.id === workspaceId ? { ...workspace, sessions } : workspace,
      );

    pinnedWorkspaces.value = replace(pinnedWorkspaces.value);
    unpinnedWorkspaces.value = replace(unpinnedWorkspaces.value);
  }

  async function loadWorkspaces() {
    if (loading.value) return;

    loading.value = true;
    workspaceError.value = "";
    try {
      const [pinnedResponse, unpinnedResponse] = await Promise.all([
        electronAPI.getWorkspaceList({ pinned: true }),
        electronAPI.getWorkspaceList({ pinned: false }),
      ]);
      const [pinned, unpinned] = await Promise.all([
        Promise.all(pinnedResponse.workspaces.map(withSessions)),
        Promise.all(unpinnedResponse.workspaces.map(withSessions)),
      ]);
      pinnedWorkspaces.value = pinned;
      unpinnedWorkspaces.value = unpinned;
    } catch (error) {
      workspaceError.value = getErrorMessage(error, "读取工作空间失败，请重试。");
    } finally {
      loading.value = false;
    }
  }

  async function loadWorkspaceSessions(workspaceId: number) {
    workspaceError.value = "";
    try {
      const response = await electronAPI.getSessionList({ workspaceId });
      replaceWorkspaceSessions(workspaceId, withExecutionStatus(response.sessions));
    } catch (error) {
      workspaceError.value = getErrorMessage(error, "读取会话失败，请重试。");
    }
  }

  async function setWorkspacePinned(workspace: WorkspaceInfo) {
    if (updatingWorkspaceId.value !== undefined) return;

    updatingWorkspaceId.value = workspace.id;
    workspaceError.value = "";
    try {
      await electronAPI.setWorkspacePinned({
        workspaceId: workspace.id,
        pinned: !workspace.pinned,
      });
      await loadWorkspaces();
    } catch (error) {
      workspaceError.value = getErrorMessage(error, "更新置顶状态失败，请重试。");
    } finally {
      updatingWorkspaceId.value = undefined;
    }
  }

  function updateSessionTitle(payload: MessageEventPayload) {
    const update = (workspaces: WorkspaceWithSessions[], payload: UpdateSessionPayload) =>
      workspaces.map((workspace) => ({
        ...workspace,
        sessions: workspace.sessions.map((session) =>
          session.id === payload.sessionId ? { ...session, ...payload } : session,
        ),
      }));

    // 获取 session 的状态 started, completed, stopped, failed, 更新 session 状态
    if (payload.type === "status") {
      pinnedWorkspaces.value = update(pinnedWorkspaces.value, {
        sessionId: payload.sessionId,
        status: payload.status,
      });
      unpinnedWorkspaces.value = update(unpinnedWorkspaces.value, {
        sessionId: payload.sessionId,
        status: payload.status,
      });
    }

    // 更新 session 标题
    if (payload.type !== "title_updated") return;

    pinnedWorkspaces.value = update(pinnedWorkspaces.value, {
      sessionId: payload.sessionId,
      title: payload.title,
    });
    unpinnedWorkspaces.value = update(unpinnedWorkspaces.value, {
      sessionId: payload.sessionId,
      title: payload.title,
    });
  }

  onMounted(() => {
    addEventListener(MESSAGE_EVENT, updateSessionTitle);
    void loadWorkspaces();
  });

  onBeforeUnmount(() => {
    removeEventListener(MESSAGE_EVENT, updateSessionTitle);
  });

  return {
    pinnedWorkspaces,
    unpinnedWorkspaces,
    loading,
    workspaceError,
    updatingWorkspaceId,
    loadWorkspaces,
    loadWorkspaceSessions,
    setWorkspacePinned,
  };
}
