import type { Automation, CreateAutomationRequest, UpdateAutomationRequest } from "@shared/api";
import { defineStore } from "pinia";
import { ref, toRaw } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useAutomationStore = defineStore("automation", () => {
  const automationList = ref<Automation[]>([]);
  const loading = ref(false);
  const detailLoading = ref(false);
  const automationDetails = ref<Record<number, Automation>>({});

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
    automationDetails.value[automation.id] = automation;
    automationList.value = [
      automation,
      ...automationList.value.filter((item) => item.id !== automation.id),
    ];
    return automation;
  }

  async function updateAutomation(request: UpdateAutomationRequest) {
    const { automation } = await electronAPI.updateAutomation(toRaw(request));
    automationDetails.value[automation.id] = automation;
    automationList.value = automationList.value.map((item) =>
      item.id === automation.id ? automation : item,
    );
    return automation;
  }

  async function deleteAutomation(id: number) {
    await electronAPI.deleteAutomation({ id });
    automationList.value = automationList.value.filter((item) => item.id !== id);
    delete automationDetails.value[id];
  }

  function getAutomationById(id: number) {
    return automationDetails.value[id] ?? automationList.value.find((item) => item.id === id);
  }

  async function fetchAutomation(id: number) {
    detailLoading.value = true;
    try {
      const { automation } = await electronAPI.getAutomation({ id });
      automationDetails.value[automation.id] = automation;
      automationList.value = automationList.value.map((item) =>
        item.id === automation.id ? automation : item,
      );
      return automation;
    } finally {
      detailLoading.value = false;
    }
  }

  return {
    automationList,
    automationDetails,
    loading,
    detailLoading,
    getAutomationById,
    fetchAutomationList,
    fetchAutomation,
    createAutomation,
    updateAutomation,
    deleteAutomation,
  };
});
