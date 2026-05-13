import type { Session } from "@shared/api";
import { defineStore } from "pinia";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const SIDEBAR_SESSION_LIMIT = 5;

export const useSessionStore = defineStore("session", () => {
  // ─── 状态 ───
  const sessionMap = ref<{ [workspaceId: number]: Session[] }>({});
  const sessionTotals = ref<{ [workspaceId: number]: number }>({});
  const lastDeletedSession = ref<Session | null>(null);

  // ─── Getters ───
  function hasMoreSessions(workspaceId: number): boolean {
    return (sessionTotals.value[workspaceId] ?? 0) > SIDEBAR_SESSION_LIMIT;
  }

  // ─── Actions ───
  async function fetchSessionList(workspaceIds: number[]) {
    const response = await electronAPI.getSessionList({
      workspaceIds: workspaceIds,
      limit: SIDEBAR_SESSION_LIMIT,
    });
    const nextMap = { ...sessionMap.value };
    const incoming = response.sessions || {};

    workspaceIds.forEach((workspaceId) => {
      nextMap[workspaceId] = incoming[workspaceId] || [];
    });

    sessionMap.value = nextMap;

    if (response.totals) {
      sessionTotals.value = { ...sessionTotals.value, ...response.totals };
    }

    return sessionMap.value;
  }

  async function refreshWorkspaceSessions(workspaceId: number) {
    return fetchSessionList([workspaceId]);
  }

  async function renameSession(id: number, title: string) {
    const { session } = await electronAPI.renameSession({ id, title });
    const list = sessionMap.value[session.workspaceId];
    if (list) {
      const idx = list.findIndex((s) => s.id === id);
      if (idx !== -1) list[idx] = session;
    }
    return session;
  }

  async function deleteSession(id: number, workspaceId: number) {
    const response = await electronAPI.deleteSession({ id });
    await refreshWorkspaceSessions(workspaceId);
    lastDeletedSession.value = response.session;
    return response.session;
  }

  /** 主进程自动生成标题后通过 EVENT_BUS 同步 */
  function applySessionTitleFromMain(session: Session) {
    const list = sessionMap.value[session.workspaceId];
    if (list) {
      const idx = list.findIndex((s) => s.id === session.id);
      if (idx !== -1) {
        list[idx] = session;
      }
    }
  }

  /** 将指定会话移到所属工作区列表顶部（发送消息时调用） */
  function bumpSessionToTop(sessionId: number) {
    for (const list of Object.values(sessionMap.value)) {
      const idx = list.findIndex((s) => s.id === sessionId);
      if (idx < 0) continue;
      if (idx > 0) {
        const [session] = list.splice(idx, 1);
        session.lastActiveAt = new Date();
        list.unshift(session);
      }
      return;
    }
  }

  return {
    sessionMap,
    sessionTotals,
    lastDeletedSession,
    fetchSessionList,
    refreshWorkspaceSessions,
    hasMoreSessions,
    renameSession,
    deleteSession,
    applySessionTitleFromMain,
    bumpSessionToTop,
  };
});
