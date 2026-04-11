<script setup lang="ts">
import type { Automation } from "@shared/api";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAutomationStore } from "@/stores/automation";

const { automation, onDeleted } = defineProps<{
  automation: Automation;
  onDeleted?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const automationStore = useAutomationStore();
const loading = ref(false);

async function handleDelete() {
  loading.value = true;
  try {
    await automationStore.deleteAutomation(automation.id);
    onDeleted?.();
    emit("close");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <DialogHeader>
    <DialogTitle>确认删除</DialogTitle>
    <DialogDescription
      >确定要删除自动化「{{ automation.title }}」吗？此操作无法撤销。</DialogDescription
    >
  </DialogHeader>
  <DialogFooter>
    <Button type="button" variant="outline" @click="emit('close')">取消</Button>
    <Button type="button" variant="destructive" :disabled="loading" @click="handleDelete">
      确认删除
    </Button>
  </DialogFooter>
</template>
