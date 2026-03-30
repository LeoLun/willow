<script setup lang="ts">
import type { AddModelRequest, ModelConfig } from "@shared/api";
import { ref, onMounted } from "vue";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useConfigStore } from "@/stores/config";

const { model, onSaved } = defineProps<{
  model?: ModelConfig;
  onSaved?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const configStore = useConfigStore();
const isValid = ref(true);
const loading = ref(false);

const form = ref<AddModelRequest>({
  modelId: "",
  name: "",
  api: "openai-completions",
  provider: "",
  baseUrl: "",
  apiKey: "",
  reasoning: false,
  contextWindow: 64000,
  maxTokens: 8192,
});

onMounted(() => {
  if (model) {
    form.value = {
      modelId: model.modelId,
      name: model.name,
      api: model.api,
      provider: model.provider,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey || "",
      reasoning: model.reasoning,
      contextWindow: model.contextWindow,
      maxTokens: model.maxTokens,
    };
  }
});

async function handleSubmit() {
  if (!form.value.modelId || !form.value.name || !form.value.provider || !form.value.baseUrl) {
    isValid.value = false;
    return;
  }
  isValid.value = true;
  loading.value = true;
  try {
    if (model) {
      await configStore.updateModel({ id: model.id, ...form.value });
    } else {
      await configStore.addModel(form.value);
    }
    onSaved?.();
    emit("close");
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <DialogHeader>
    <DialogTitle>{{ model ? "编辑模型" : "添加模型" }}</DialogTitle>
    <DialogDescription>{{
      model ? "修改模型配置信息" : "填写模型配置信息以添加新模型"
    }}</DialogDescription>
  </DialogHeader>

  <form class="grid max-h-[60vh] gap-4 overflow-y-auto py-4" @submit.prevent="handleSubmit">
    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">名称</Label>
      <Input v-model="form.name" class="col-span-3" placeholder="DeepSeek Chat" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">模型 ID</Label>
      <Input v-model="form.modelId" class="col-span-3" placeholder="deepseek-chat" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">Provider</Label>
      <Input v-model="form.provider" class="col-span-3" placeholder="deepseek" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">API 类型</Label>
      <Input v-model="form.api" class="col-span-3" placeholder="openai-completions" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">Base URL</Label>
      <Input v-model="form.baseUrl" class="col-span-3" placeholder="https://api.deepseek.com" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">API Key</Label>
      <Input v-model="form.apiKey" type="password" class="col-span-3" placeholder="sk-..." />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">上下文窗口</Label>
      <Input v-model.number="form.contextWindow" type="number" class="col-span-3" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">最大 Token</Label>
      <Input v-model.number="form.maxTokens" type="number" class="col-span-3" />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">推理模型</Label>
      <div class="col-span-3">
        <Switch :model-value="form.reasoning" @update:model-value="form.reasoning = $event" />
      </div>
    </div>

    <p v-if="!isValid" class="text-center text-sm text-destructive">
      请填写名称、模型 ID、Provider 和 Base URL
    </p>

    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')">取消</Button>
      <Button type="submit" :disabled="loading">{{ model ? "保存" : "添加" }}</Button>
    </DialogFooter>
  </form>
</template>
