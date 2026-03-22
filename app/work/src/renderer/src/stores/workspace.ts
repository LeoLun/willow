import { ref } from "vue";
import { defineStore } from "pinia";
import { electronAPI } from "@/lib/ipc";
import type { Workspace } from "@shared/api";

export const useWorkspaceStore = defineStore("workspace", () => {
  // ─── 状态 ───
  const workspaceList = ref<Workspace[]>([]);

  // ─── Actions ───
  async function fetchWorkspaceList() {
    const response = await electronAPI.getWorkspaceList();
    workspaceList.value = response.workspaces || [];
    return workspaceList.value;
  }

  return { workspaceList, fetchWorkspaceList };
});
