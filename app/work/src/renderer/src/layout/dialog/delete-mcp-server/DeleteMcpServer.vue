<script setup lang="ts">
import type { McpServerConfig } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@willow/shadcn/components/ui/dialog";
import { ref } from "vue";
import { useMcpStore } from "@/stores/mcp";

const { mcpServer, workspaceId, onDeleted } = defineProps<{
  mcpServer: McpServerConfig;
  workspaceId?: number;
  onDeleted?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const mcpStore = useMcpStore();
const loading = ref(false);

async function handleDelete() {
  loading.value = true;
  try {
    await mcpStore.deleteServer(workspaceId, mcpServer.name);
    onDeleted?.();
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
    <DialogTitle>确认删除 MCP 服务</DialogTitle>
    <DialogDescription>
      确定要删除 MCP 服务「{{ mcpServer.name }}」吗？此操作将立即断开连接。
    </DialogDescription>
  </DialogHeader>
  <DialogFooter>
    <Button type="button" variant="outline" @click="emit('close')">取消</Button>
    <Button type="button" variant="destructive" :disabled="loading" @click="handleDelete">
      确认删除
    </Button>
  </DialogFooter>
</template>
