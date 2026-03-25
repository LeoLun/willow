<script setup lang="ts">
import type { Session } from "@shared/api";
import { ref } from "vue";
import { Button } from "@/components/ui/button";
import { DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { electronAPI } from "@/lib/ipc";

const { session } = defineProps<{
  session: Session;
}>();

const emit = defineEmits<{
  close: [];
  renamed: [session: Session];
}>();

const title = ref(session.title);
const loading = ref(false);

async function handleSubmit() {
  const trimmed = title.value.trim();
  if (!trimmed || loading.value) return;
  loading.value = true;
  try {
    const { session: newSession } = await electronAPI.renameSession({
      id: session.id,
      title: trimmed,
    });
    emit("renamed", newSession);
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
    <DialogTitle>重命名会话</DialogTitle>
    <DialogDescription>输入新的会话名称</DialogDescription>
  </DialogHeader>
  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <Input v-model="title" placeholder="会话名称" autofocus />
    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')"> 取消 </Button>
      <Button type="submit" :disabled="!title.trim() || loading"> 修改 </Button>
    </DialogFooter>
  </form>
</template>
