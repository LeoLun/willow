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
import { Folder, FolderOpen } from "lucide-vue-next";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const emit = defineEmits<{
  close: [];
  created: [workspace: Workspace];
}>();

const name = ref("");
const loading = ref(false);
const path = ref("");

async function handleSelectDirectory() {
  const result = await electronAPI.selectDirectory();
  if (result.selected && result.path) {
    path.value = result.path;
  }
}

async function handleSubmit() {
  const trimmed = name.value.trim();
  if (!trimmed || loading.value) return;
  loading.value = true;
  try {
    const { workspace } = await electronAPI.createWorkspace({
      name: trimmed,
      path: path.value.trim(),
    });
    emit("created", workspace);
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
    <DialogTitle>创建新工作空间</DialogTitle>
    <DialogDescription>输入工作空间名称并选择项目目录</DialogDescription>
  </DialogHeader>
  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <div class="grid gap-4">
      <Input v-model="name" placeholder="工作空间名称" autofocus />
      <div class="grid gap-1.5">
        <label class="text-sm font-medium">项目目录（可选）</label>
        <Button
          v-if="!path"
          type="button"
          variant="outline"
          class="w-full"
          @click="handleSelectDirectory"
        >
          <FolderOpen class="size-4" />
          选择目录
        </Button>
        <button
          v-else
          type="button"
          class="flex h-9 items-center gap-1.5 rounded-md border bg-secondary px-3"
          @click="handleSelectDirectory"
        >
          <Folder class="size-4 shrink-0" />
          <span class="truncate text-[13px]">{{ path }}</span>
        </button>
      </div>
    </div>
    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')"> 取消 </Button>
      <Button type="submit" :disabled="!name.trim() || loading"> 创建 </Button>
    </DialogFooter>
  </form>
</template>
