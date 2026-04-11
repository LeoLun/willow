import type { Automation, CreateAutomationRequest, UpdateAutomationRequest } from "@shared/api";
import { defineStore } from "pinia";
import { ref, toRaw } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useAutomationStore = defineStore("automation", () => {
  const automationList = ref<Automation[]>([]);
  const loading = ref(false);

  async function fetchAutomationList() {
    loading.value = true;
    try {
      const response = await electronAPI.getAutomationList();
      automationList.value = response.automations ?? [];
      return automationList.value;
    } finally {
      loading.value = false;
    }
  }

  async function createAutomation(request: CreateAutomationRequest) {
    const { automation } = await electronAPI.createAutomation(toRaw(request));
    automationList.value = [
      automation,
      ...automationList.value.filter((item) => item.id !== automation.id),
    ];
    return automation;
  }

  async function updateAutomation(request: UpdateAutomationRequest) {
    const { automation } = await electronAPI.updateAutomation(toRaw(request));
    automationList.value = automationList.value.map((item) =>
      item.id === automation.id ? automation : item,
    );
    return automation;
  }

  async function deleteAutomation(id: number) {
    await electronAPI.deleteAutomation({ id });
    automationList.value = automationList.value.filter((item) => item.id !== id);
  }

  return {
    automationList,
    loading,
    fetchAutomationList,
    createAutomation,
    updateAutomation,
    deleteAutomation,
  };
});
