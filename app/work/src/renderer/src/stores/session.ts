import { ref } from "vue";
import { defineStore } from "pinia";
import { electronAPI } from "@/lib/ipc";
import type { Session } from "@shared/api";

export const useSessionStore = defineStore("session", () => {
  // ─── 状态 ───
  const sessionMap = ref<{ [workspaceId: number]: Session[] }>({});

  // ─── Actions ───
  async function fetchSessionList(workspaceIds: number[]) {
    const response = await electronAPI.getSessionList({
      workspaceIds: workspaceIds,
    });
    sessionMap.value = response.sessions || {};
    return sessionMap.value;
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
    await electronAPI.deleteSession({ id });
    const list = sessionMap.value[workspaceId];
    if (list) {
      sessionMap.value[workspaceId] = list.filter((s) => s.id !== id);
    }
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

  return {
    sessionMap,
    fetchSessionList,
    renameSession,
    deleteSession,
    applySessionTitleFromMain,
  };
});
