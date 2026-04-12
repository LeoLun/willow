<script setup lang="ts">
import type { Session } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@willow/shadcn/components/ui/dialog";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const { session } = defineProps<{
  session: Session;
}>();

const emit = defineEmits<{
  close: [];
  deleted: [session: Session];
}>();

const loading = ref(false);

async function handleSubmit() {
  loading.value = true;
  try {
    await electronAPI.deleteSession({ id: session.id });
    emit("deleted", session);
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
    <DialogDescription> 确认删除会话 「{{ session.title }}」 吗？ </DialogDescription>
  </DialogHeader>
  <DialogFooter>
    <Button type="button" variant="outline" @click="emit('close')"> 取消 </Button>
    <Button type="button" variant="destructive" @click="handleSubmit" :disabled="loading">
      确认删除
    </Button>
  </DialogFooter>
</template>
