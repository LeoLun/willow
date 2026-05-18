import type { Workspace } from "@shared/api";
import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useWorkspaceStore = defineStore("workspace", () => {
  // ─── 状态 ───
  const workspaceList = ref<Workspace[]>([]);
  const projectWorkspaceList = computed(() =>
    workspaceList.value.filter((workspace) => workspace.kind !== "conversation"),
  );

  // ─── Actions ───
  async function fetchWorkspaceList() {
    const response = await electronAPI.getWorkspaceList();
    workspaceList.value = response.workspaces || [];
    return workspaceList.value;
  }

  return { workspaceList, projectWorkspaceList, fetchWorkspaceList };
});
