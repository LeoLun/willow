import type { ModelConfig, AddModelRequest, UpdateModelRequest } from "@shared/api";
import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useConfigStore = defineStore("config", () => {
  // ─── 状态 ───
  const modelList = ref<ModelConfig[]>([]);

  // ─── Getters ───
  const defaultModel = computed(() => modelList.value.find((m) => m.isDefault));

  // ─── Actions ───
  async function fetchModelList() {
    const response = await electronAPI.getModelList();
    modelList.value = response.models || [];
    return modelList.value;
  }

  async function addModel(data: AddModelRequest) {
    const { model } = await electronAPI.addModel(toRaw(data));
    await fetchModelList();
    return model;
  }

  async function updateModel(data: UpdateModelRequest) {
    const { model } = await electronAPI.updateModel(toRaw(data));
    await fetchModelList();
    return model;
  }

  async function deleteModel(id: number) {
    await electronAPI.deleteModel({ id });
    await fetchModelList();
  }

  async function setDefaultModel(id: number) {
    const { model } = await electronAPI.setDefaultModel({ id });
    await fetchModelList();
    return model;
  }

  return {
    modelList,
    defaultModel,
    fetchModelList,
    addModel,
    updateModel,
    deleteModel,
    setDefaultModel,
  };
});
