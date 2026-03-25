import type { Session } from "@shared/api";
import { defineStore } from "pinia";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useSessionStore = defineStore("session", () => {
  // ─── 状态 ───
  const sessionMap = ref<{ [workspaceId: number]: Session[] }>({});

  // ─── Actions ───
  async function fetchSessionList(workspaceIds: number[]) {
    const response = await electronAPI.getSessionList({
      workspaceIds: workspaceIds,
    });
    const nextMap = { ...sessionMap.value };
    const incoming = response.sessions || {};

    workspaceIds.forEach((workspaceId) => {
      // 控制器只返回有会话的工作区，这里显式回填空数组避免保留旧数据
      nextMap[workspaceId] = incoming[workspaceId] || [];
    });

    sessionMap.value = nextMap;
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
    fetchSessionList,
    renameSession,
    deleteSession,
    applySessionTitleFromMain,
    bumpSessionToTop,
  };
});
