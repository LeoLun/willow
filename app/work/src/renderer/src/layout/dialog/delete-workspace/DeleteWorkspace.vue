<script setup lang="ts">
import type { Workspace } from "@shared/api";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { electronAPI } from "@/lib/ipc";
const { workspace } = defineProps<{
  workspace: Workspace;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [workspace: { id: number; name: string; path: string }];
}>();

const loading = ref(false);

async function handleSubmit() {
  try {
    await electronAPI.deleteWorkspace({
      id: workspace.id,
    });
    emit("deleted", workspace);
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
    <DialogDescription> 确认删除工作区 「{{ workspace.name }}」 吗？ </DialogDescription>
  </DialogHeader>
  <DialogFooter>
    <Button type="button" variant="outline" @click="emit('close')"> 取消 </Button>
    <Button type="button" variant="destructive" @click="handleSubmit"> 确认删除 </Button>
  </DialogFooter>
</template>
