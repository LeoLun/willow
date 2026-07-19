<script setup lang="ts">
import type { WorkspaceInfo } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { CircleAlert, LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  workspace: WorkspaceInfo;
}>();

const emit = defineEmits<{
  close: [];
  renamed: [workspace: WorkspaceInfo];
}>();

const name = ref(props.workspace.name);
const submitting = ref(false);
const errorMessage = ref("");
const trimmedName = computed(() => name.value.trim());
const canSubmit = computed(
  () =>
    !submitting.value && trimmedName.value.length > 0 && trimmedName.value !== props.workspace.name,
);

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function renameWorkspace() {
  if (!canSubmit.value) return;

  submitting.value = true;
  errorMessage.value = "";
  try {
    const response = await electronAPI.renameWorkspace({
      workspaceId: props.workspace.id,
      name: trimmedName.value,
    });
    emit("renamed", response.workspace);
    emit("close");
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "重命名工作空间失败，请重试。");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <form class="grid gap-5" @submit.prevent="renameWorkspace">
    <DialogHeader>
      <DialogTitle>重命名工作空间</DialogTitle>
      <DialogDescription>输入工作空间的新名称，磁盘上的文件夹名称不会改变。</DialogDescription>
    </DialogHeader>

    <div class="grid gap-2">
      <label for="workspace-name" class="text-sm font-medium">名称</label>
      <Input
        id="workspace-name"
        v-model="name"
        autofocus
        :disabled="submitting"
        :aria-invalid="Boolean(errorMessage) || undefined"
      />
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
      <Button type="button" variant="outline" :disabled="submitting" @click="emit('close')">
        取消
      </Button>
      <Button type="submit" :disabled="!canSubmit" :aria-busy="submitting || undefined">
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        确认
      </Button>
    </DialogFooter>
  </form>
</template>
