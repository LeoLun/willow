<script setup lang="ts">
import type { ModelConfig } from "@shared/api";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useConfigStore } from "@/stores/config";

const { model, onDeleted } = defineProps<{
  model: ModelConfig;
  onDeleted?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const configStore = useConfigStore();
const loading = ref(false);

async function handleDelete() {
  loading.value = true;
  try {
    await configStore.deleteModel(model.id);
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
    <DialogDescription> 确定要删除模型「{{ model.name }}」吗？此操作无法撤销。 </DialogDescription>
  </DialogHeader>
  <DialogFooter>
    <Button type="button" variant="outline" @click="emit('close')">取消</Button>
    <Button type="button" variant="destructive" :disabled="loading" @click="handleDelete">
      确认删除
    </Button>
  </DialogFooter>
</template>
