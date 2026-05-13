import { computed, ref, watch, type Ref } from "vue";
import { electronAPI } from "@/lib/ipc";

export function useWorkspaceSettings(workspaceId: Ref<number>) {
  const workspacePath = ref("");
  const soulContent = ref("");
  const isLoading = ref(false);
  const isSaving = ref(false);
  const errorMessage = ref("");
  const saveMessage = ref("");

  async function loadSettings(id: number) {
    if (!id || Number.isNaN(id)) {
      workspacePath.value = "";
      soulContent.value = "";
      errorMessage.value = "";
      saveMessage.value = "";
      return;
    }

    isLoading.value = true;
    errorMessage.value = "";
    saveMessage.value = "";

    try {
      const response = await electronAPI.getWorkspaceSettings({ id });
      if (workspaceId.value !== id) {
        return;
      }
      workspacePath.value = response.workspace.path;
      soulContent.value = response.soulContent;
    } catch (error) {
      if (workspaceId.value !== id) {
        return;
      }
      errorMessage.value = error instanceof Error ? error.message : "读取工作空间设置失败";
    } finally {
      if (workspaceId.value === id) {
        isLoading.value = false;
      }
    }
  }

  async function saveSettings() {
    if (!workspaceId.value || Number.isNaN(workspaceId.value)) {
      return;
    }

    isSaving.value = true;
    errorMessage.value = "";
    saveMessage.value = "";

    try {
      await electronAPI.updateWorkspaceSettings({
        id: workspaceId.value,
        path: workspacePath.value,
        soulContent: soulContent.value,
      });
      saveMessage.value = "设置已保存";
    } catch (error) {
      errorMessage.value = error instanceof Error ? error.message : "保存工作空间设置失败";
    } finally {
      isSaving.value = false;
    }
  }

  watch(
    workspaceId,
    (id) => {
      void loadSettings(id);
    },
    { immediate: true },
  );

  return {
    workspacePath,
    soulContent,
    isLoading: computed(() => isLoading.value),
    isSaving: computed(() => isSaving.value),
    errorMessage: computed(() => errorMessage.value),
    saveMessage: computed(() => saveMessage.value),
    saveSettings,
    reloadSettings: async () => loadSettings(workspaceId.value),
  };
}
