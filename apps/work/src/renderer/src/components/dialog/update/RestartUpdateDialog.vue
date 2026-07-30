<script setup lang="ts">
import { DialogDescription, DialogTitle } from "@willow/shadcn/components/ui/dialog";
import { Button } from "@/components/ui/button";

const props = defineProps<{ onConfirm: () => void | Promise<void> }>();
const emit = defineEmits<{ close: [] }>();

async function confirm(): Promise<void> {
  emit("close");
  await props.onConfirm();
}
</script>

<template>
  <DialogTitle>重启并更新</DialogTitle>
  <DialogDescription>当前仍有任务在运行，重启会停止这些任务。确定现在重启吗？</DialogDescription>
  <div class="flex justify-end gap-2 pt-3">
    <Button variant="secondary" @click="emit('close')">取消</Button>
    <Button @click="confirm">重启</Button>
  </div>
</template>
