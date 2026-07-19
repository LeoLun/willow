<script setup lang="ts">
import type { WorkspaceInfo } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@willow/shadcn/components/ui/dialog";
import { CircleAlert, LoaderCircle, TriangleAlert } from "lucide-vue-next";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  workspace: WorkspaceInfo;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [workspaceId: number];
}>();

const submitting = ref(false);
const errorMessage = ref("");

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function deleteWorkspace() {
  if (submitting.value) return;

  submitting.value = true;
  errorMessage.value = "";
  try {
    await electronAPI.deleteWorkspace({ workspaceId: props.workspace.id });
    emit("deleted", props.workspace.id);
    emit("close");
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "删除工作空间失败，请重试。");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="grid gap-5">
    <DialogHeader>
      <DialogTitle>删除工作空间</DialogTitle>
      <DialogDescription>确定要删除“{{ workspace.name }}”吗？</DialogDescription>
    </DialogHeader>

    <div
      class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>该操作会永久删除此工作空间及其全部会话记录，但不会删除磁盘上的文件。</p>
    </div>

    <div v-if="errorMessage" class="flex items-center gap-2 text-sm text-destructive" role="alert">
      <CircleAlert class="size-4 shrink-0" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" :disabled="submitting" @click="emit('close')">
        取消
      </Button>
      <Button
        type="button"
        variant="destructive"
        :disabled="submitting"
        :aria-busy="submitting || undefined"
        @click="deleteWorkspace"
      >
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        删除
      </Button>
    </DialogFooter>
  </div>
</template>
