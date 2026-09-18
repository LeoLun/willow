<script setup lang="ts">
import type { McpAuthRequiredEvent } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { DialogDescription, DialogHeader, DialogTitle } from "@willow/shadcn/components/ui/dialog";
import { ref } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<McpAuthRequiredEvent>();
const emit = defineEmits<{ close: [] }>();
const busy = ref(false);
const error = ref("");

async function login() {
  busy.value = true;
  error.value = "";
  try {
    await electronAPI.manageMcp({
      ...(props.scope === "global"
        ? { scope: "global" as const }
        : { workspaceId: props.workspaceId }),
      serverName: props.serverName,
      action: "login",
    });
    emit("close");
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : "登录失败，请重试。";
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="grid gap-4">
    <DialogHeader>
      <DialogTitle>{{ serverName }} 需要登录</DialogTitle>
      <DialogDescription
        >登录后才能获取该服务的工具。点击「去登录」在浏览器中完成授权，完成后会继续获取工具列表。</DialogDescription
      >
    </DialogHeader>
    <p v-if="busy" class="text-sm text-muted-foreground" role="status">
      正在准备登录或等待浏览器授权…
    </p>
    <p v-if="error" class="text-sm text-destructive" role="alert">{{ error }}</p>
    <div class="flex justify-end gap-2">
      <Button variant="outline" @click="emit('close')">{{ busy ? "取消登录" : "稍后" }}</Button>
      <Button :disabled="busy" @click="login">{{
        busy ? "等待授权…" : error ? "重试登录" : "去登录"
      }}</Button>
    </div>
  </div>
</template>
