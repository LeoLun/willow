<script setup lang="ts">
import type { Workspace } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const { workspace } = defineProps<{
  workspace: Workspace;
}>();

const emit = defineEmits<{
  close: [];
  renamed: [workspace: Workspace];
}>();

const name = ref("");
const loading = ref(false);

async function handleSubmit() {
  const trimmed = name.value.trim();
  if (!trimmed || loading.value) return;
  loading.value = true;
  try {
    const { workspace: newWorkspace } = await electronAPI.renameWorkspace({
      id: workspace.id,
      name: trimmed,
    });
    emit("renamed", newWorkspace);
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
    <DialogTitle>创建工作区</DialogTitle>
    <DialogDescription>输入工作区名称以修改工作区名称</DialogDescription>
  </DialogHeader>
  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <Input v-model="name" placeholder="工作区名称" autofocus />
    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')"> 取消 </Button>
      <Button type="submit" :disabled="!name.trim() || loading"> 修改 </Button>
    </DialogFooter>
  </form>
</template>
