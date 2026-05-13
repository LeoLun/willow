<script setup lang="ts">
import type { TavilyKeyConfig } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@willow/shadcn/components/ui/dialog";
import { ref } from "vue";
import { useConfigStore } from "@/stores/config";

const { tavilyKey, onDeleted } = defineProps<{
  tavilyKey: TavilyKeyConfig;
  onDeleted?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const configStore = useConfigStore();
const loading = ref(false);

function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 4) + "****" + key.slice(-4);
}

async function handleDelete() {
  loading.value = true;
  try {
    await configStore.deleteTavilyKey(tavilyKey.id);
    onDeleted?.();
    emit("close");
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <DialogHeader>
    <DialogTitle>确认删除</DialogTitle>
    <DialogDescription>
      确定要删除 Tavily Key「{{ maskKey(tavilyKey.apiKey) }}」吗？此操作无法撤销。
    </DialogDescription>
  </DialogHeader>
  <DialogFooter>
    <Button type="button" variant="outline" @click="emit('close')">取消</Button>
    <Button type="button" variant="destructive" :disabled="loading" @click="handleDelete">
      确认删除
    </Button>
  </DialogFooter>
</template>
