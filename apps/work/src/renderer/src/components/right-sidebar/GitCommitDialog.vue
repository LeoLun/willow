<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@willow/shadcn/components/ui/dialog";
import { Textarea } from "@willow/shadcn/components/ui/textarea";
import { CircleAlert, LoaderCircle } from "lucide-vue-next";
import { computed, ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  additions: number;
  deletions: number;
  stagedCount: number;
  workspaceId: number;
}>();

const emit = defineEmits<{
  close: [];
  committed: [commitHash: string];
}>();

const message = ref("");
const submitting = ref(false);
const errorMessage = ref("");
const normalizedMessage = computed(() => message.value.trim());

async function commit(): Promise<void> {
  if (submitting.value || !normalizedMessage.value) return;
  submitting.value = true;
  errorMessage.value = "";
  try {
    const response = await electronAPI.commitGitChanges({
      workspaceId: props.workspaceId,
      message: normalizedMessage.value,
    });
    emit("committed", response.commitHash);
    emit("close");
  } catch (error) {
    errorMessage.value = error instanceof Error ? error.message : "提交失败，请重试";
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="grid gap-5">
    <DialogHeader>
      <DialogTitle>提交已暂存的变更</DialogTitle>
      <DialogDescription>
        将提交 {{ stagedCount }} 个文件，
        <span class="text-emerald-600">+{{ additions }}</span>
        <span class="ml-1 text-red-600">-{{ deletions }}</span>
      </DialogDescription>
    </DialogHeader>

    <div class="grid gap-2">
      <label for="git-commit-message" class="text-sm font-medium">提交信息</label>
      <Textarea
        id="git-commit-message"
        v-model="message"
        class="min-h-28 resize-y"
        placeholder="简要说明本次修改"
        :disabled="submitting"
        :aria-invalid="Boolean(errorMessage) || undefined"
        @keydown.meta.enter="commit"
        @keydown.ctrl.enter="commit"
      />
      <p class="text-xs text-muted-foreground">按 ⌘/Ctrl + Enter 提交</p>
    </div>

    <div v-if="errorMessage" class="flex items-start gap-2 text-sm text-destructive" role="alert">
      <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{{ errorMessage }}</span>
    </div>

    <DialogFooter>
      <Button type="button" variant="outline" :disabled="submitting" @click="emit('close')">
        取消
      </Button>
      <Button
        type="button"
        :disabled="submitting || !normalizedMessage"
        :aria-busy="submitting || undefined"
        @click="commit"
      >
        <LoaderCircle v-if="submitting" class="animate-spin" aria-hidden="true" />
        提交
      </Button>
    </DialogFooter>
  </div>
</template>
