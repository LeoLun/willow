import type {
  ModelConfig,
  TavilyKeyConfig,
  AddTavilyKeyRequest,
  UpdateTavilyKeyRequest,
} from "@shared/api";
import { defineStore } from "pinia";
import { computed, ref, toRaw } from "vue";
import { electronAPI } from "@/lib/ipc";

export const useConfigStore = defineStore("config", () => {
  // ─── 状态 ───
  const modelList = ref<ModelConfig[]>([]);
  const tavilyKeyList = ref<TavilyKeyConfig[]>([]);

  // ─── Getters ───
  const defaultModel = computed(() => modelList.value.find((m) => m.isDefault));
  const hasTavilyKeys = computed(() => tavilyKeyList.value.length > 0);

  // ─── Actions: 模型 ───
  async function fetchModelList() {
    const response = await electronAPI.getModelList();
    modelList.value = response.models || [];
    return modelList.value;
  }

  async function setDeepSeekApiKey(apiKey: string) {
    const { models } = await electronAPI.setDeepSeekApiKey({ apiKey: toRaw(apiKey) as string });
    await fetchModelList();
    return models;
  }

  async function setDefaultModel(id: number) {
    const { model } = await electronAPI.setDefaultModel({ id });
    await fetchModelList();
    return model;
  }

  // ─── Actions: Tavily ───
  async function fetchTavilyKeyList() {
    const response = await electronAPI.getTavilyKeyList();
    tavilyKeyList.value = response.keys || [];
    return tavilyKeyList.value;
  }

  async function addTavilyKey(data: AddTavilyKeyRequest) {
    const { key } = await electronAPI.addTavilyKey(toRaw(data));
    await fetchTavilyKeyList();
    return key;
  }

  async function updateTavilyKey(data: UpdateTavilyKeyRequest) {
    const { key } = await electronAPI.updateTavilyKey(toRaw(data));
    await fetchTavilyKeyList();
    return key;
  }

  async function deleteTavilyKey(id: number) {
    await electronAPI.deleteTavilyKey({ id });
    await fetchTavilyKeyList();
  }

  return {
    modelList,
    defaultModel,
    fetchModelList,
    setDeepSeekApiKey,
    setDefaultModel,
    tavilyKeyList,
    hasTavilyKeys,
    fetchTavilyKeyList,
    addTavilyKey,
    updateTavilyKey,
    deleteTavilyKey,
  };
});
