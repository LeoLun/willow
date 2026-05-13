<script setup lang="ts">
import type { TavilyKeyConfig } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import { ref, onMounted } from "vue";
import { useConfigStore } from "@/stores/config";

const { tavilyKey, onSaved } = defineProps<{
  tavilyKey?: TavilyKeyConfig;
  onSaved?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const configStore = useConfigStore();
const isValid = ref(true);
const loading = ref(false);

const form = ref({
  apiKey: "",
  monthlyLimit: 1000,
});

onMounted(() => {
  if (tavilyKey) {
    form.value = {
      apiKey: tavilyKey.apiKey,
      monthlyLimit: tavilyKey.monthlyLimit,
    };
  }
});

async function handleSubmit() {
  if (!form.value.apiKey.trim()) {
    isValid.value = false;
    return;
  }
  isValid.value = true;
  loading.value = true;
  try {
    if (tavilyKey) {
      await configStore.updateTavilyKey({
        id: tavilyKey.id,
        apiKey: form.value.apiKey,
        monthlyLimit: form.value.monthlyLimit,
      });
    } else {
      await configStore.addTavilyKey({
        apiKey: form.value.apiKey,
        monthlyLimit: form.value.monthlyLimit,
      });
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
    <DialogTitle>{{ tavilyKey ? "编辑 Tavily Key" : "添加 Tavily Key" }}</DialogTitle>
    <DialogDescription>{{
      tavilyKey ? "修改 Tavily API Key 配置" : "添加新的 Tavily API Key 用于网络搜索"
    }}</DialogDescription>
  </DialogHeader>

  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">API Key</Label>
      <Input v-model="form.apiKey" type="password" class="col-span-3" placeholder="tvly-..." />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">每月次数</Label>
      <Input
        v-model.number="form.monthlyLimit"
        type="number"
        class="col-span-3"
        placeholder="1000"
        :min="1"
      />
    </div>

    <p v-if="!isValid" class="text-center text-sm text-destructive">请填写 API Key</p>

    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')">取消</Button>
      <Button type="submit" :disabled="loading">{{ tavilyKey ? "保存" : "添加" }}</Button>
    </DialogFooter>
  </form>
</template>
