import type { WorkspaceFileNode } from "@shared/api";
import { computed, ref, watch, type Ref } from "vue";
import { electronAPI } from "@/lib/ipc";

export function useWorkspaceFiles(workspaceId: Ref<number>) {
  const files = ref<WorkspaceFileNode[]>([]);
  const rootPath = ref("");
  const isLoading = ref(false);
  const errorMessage = ref("");

  async function loadWorkspaceFiles(id: number) {
    if (!id || Number.isNaN(id)) {
      files.value = [];
      rootPath.value = "";
      errorMessage.value = "";
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";

    try {
      const response = await electronAPI.getWorkspaceFiles({ id });
      if (workspaceId.value !== id) {
        return;
      }
      files.value = response.files;
      rootPath.value = response.rootPath;
    } catch (error) {
      if (workspaceId.value !== id) {
        return;
      }
      files.value = [];
      rootPath.value = "";
      errorMessage.value = error instanceof Error ? error.message : "读取工作空间文件失败";
    } finally {
      if (workspaceId.value === id) {
        isLoading.value = false;
      }
    }
  }

  watch(
    workspaceId,
    (id) => {
      void loadWorkspaceFiles(id);
    },
    { immediate: true },
  );

  return {
    files: computed(() => files.value),
    rootPath: computed(() => rootPath.value),
    isLoading: computed(() => isLoading.value),
    errorMessage: computed(() => errorMessage.value),
    refresh: async () => loadWorkspaceFiles(workspaceId.value),
  };
}
