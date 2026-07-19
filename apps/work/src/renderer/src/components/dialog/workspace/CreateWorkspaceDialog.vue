<script setup lang="ts">
import type { SelectWorkspaceDirectoryResponse, WorkspaceInfo } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@willow/shadcn/components/ui/dialog";
import { CircleAlert, FolderOpen, LoaderCircle } from "lucide-vue-next";
import { computed, ref, shallowRef } from "vue";
import { electronAPI } from "@/lib/ipc";

const emit = defineEmits<{
  close: [];
  created: [workspace: WorkspaceInfo];
}>();

const directory = shallowRef<SelectWorkspaceDirectoryResponse["directory"]>(null);
const selecting = ref(false);
const submitting = ref(false);
const errorMessage = ref("");
const busy = computed(() => selecting.value || submitting.value);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function selectDirectory() {
  if (busy.value) return;

  selecting.value = true;
  errorMessage.value = "";
  try {
    const response = await electronAPI.selectWorkspaceDirectory();
    if (response.directory) {
      directory.value = response.directory;
    }
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "选择文件夹失败，请重试。");
  } finally {
    selecting.value = false;
  }
}

async function createWorkspace() {
  if (!directory.value || busy.value) return;

  submitting.value = true;
  errorMessage.value = "";
  try {
    const response = await electronAPI.createWorkspace(directory.value);
    emit("created", response.workspace);
    emit("close");
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "创建工作空间失败，请重试。");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="grid gap-5" @submit.prevent="createWorkspace">
    <DialogHeader>
      <DialogTitle>创建工作空间</DialogTitle>
      <DialogDescription>选择一个文件夹作为工作空间，名称将使用文件夹名称。</DialogDescription>
    </DialogHeader>

    <div class="grid gap-4">
      <Button
        type="button"
        variant="outline"
        class="w-full justify-start"
        :disabled="busy"
        :title="directory?.path"
        @click="selectDirectory"
      >
        <LoaderCircle v-if="selecting" class="animate-spin" aria-hidden="true" />
        <FolderOpen v-else aria-hidden="true" />
        <span class="truncate">{{ directory?.name ?? "选择文件夹" }}</span>
      </Button>

      <div
        v-if="errorMessage"
        class="flex items-center gap-2 text-sm text-destructive"
        role="alert"
      >
        <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
        <span>{{ errorMessage }}</span>
      </div>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" :disabled="busy" @click="emit('close')">
        取消
      </Button>
      <Button type="submit" :disabled="!directory || busy" :aria-busy="submitting || undefined">
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        确认
      </Button>
    </DialogFooter>
  </form>
</template>
