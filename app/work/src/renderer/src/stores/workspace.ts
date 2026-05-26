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
  const expandedWorkspaceIds = ref<Record<number, boolean>>({});

  // ─── Actions ───
  async function fetchWorkspaceList() {
    const response = await electronAPI.getWorkspaceList();
    workspaceList.value = response.workspaces || [];
    return workspaceList.value;
  }

  function isWorkspaceExpanded(workspaceId: number) {
    if (expandedWorkspaceIds.value[workspaceId] === undefined) {
      return true; // Default to expanded
    }
    return expandedWorkspaceIds.value[workspaceId];
  }

  function setWorkspaceExpanded(workspaceId: number, expanded: boolean) {
    expandedWorkspaceIds.value[workspaceId] = expanded;
  }

  return {
    workspaceList,
    projectWorkspaceList,
    fetchWorkspaceList,
    isWorkspaceExpanded,
    setWorkspaceExpanded,
  };
});
