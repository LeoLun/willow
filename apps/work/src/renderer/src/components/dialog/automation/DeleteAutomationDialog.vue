<script setup lang="ts">
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
  automationId: number;
  title: string;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [automationId: number];
}>();

const submitting = ref(false);
const errorMessage = ref("");

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function deleteAutomation() {
  if (submitting.value) return;

  submitting.value = true;
  errorMessage.value = "";
  try {
    await electronAPI.deleteAutomation({ id: props.automationId });
    emit("deleted", props.automationId);
    emit("close");
  } catch (error) {
    errorMessage.value = getErrorMessage(error, "删除自动化失败，请重试。");
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="grid gap-5">
    <DialogHeader>
      <DialogTitle>删除自动化</DialogTitle>
      <DialogDescription>确定要删除“{{ title }}”吗？</DialogDescription>
    </DialogHeader>

    <div
      class="flex gap-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
    >
      <TriangleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>删除后将同时移除触发计划与执行历史，已生成的聊天会话会保留。</p>
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
        @click="deleteAutomation"
      >
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        删除
      </Button>
    </DialogFooter>
  </div>
</template>
