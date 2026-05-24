<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import { ref } from "vue";
import { useConfigStore } from "@/stores/config";

const {
  isEdit = false,
  initialApiKey = "",
  onSaved,
} = defineProps<{
  isEdit?: boolean;
  initialApiKey?: string;
  onSaved?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const configStore = useConfigStore();
const modelType = ref("deepseek");
const apiKeyInput = ref(initialApiKey);
const isValid = ref(true);
const loading = ref(false);

async function handleSubmit() {
  if (!apiKeyInput.value.trim()) {
    isValid.value = false;
    return;
  }
  isValid.value = true;
  loading.value = true;
  try {
    await configStore.setDeepSeekApiKey(apiKeyInput.value.trim());
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
    <DialogTitle>{{ isEdit ? "修改模型" : "新增模型" }}</DialogTitle>
    <DialogDescription>
      {{ isEdit ? "修改已配置模型的 API Key" : "添加新的模型并配置其 API Key 密钥" }}
    </DialogDescription>
  </DialogHeader>

  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <!-- 模型下拉框 -->
    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">模型</Label>
      <select
        v-model="modelType"
        :disabled="isEdit"
        class="col-span-3 flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        <option value="deepseek">deepseek</option>
      </select>
    </div>

    <!-- 密钥输入框 -->
    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">密钥</Label>
      <Input v-model="apiKeyInput" type="password" class="col-span-3" placeholder="sk-..." />
    </div>

    <p v-if="!isValid" class="text-center text-sm text-destructive">请填写 API Key 密钥</p>

    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')">取消</Button>
      <Button type="submit" :disabled="loading">{{ isEdit ? "保存" : "添加" }}</Button>
    </DialogFooter>
  </form>
</template>
