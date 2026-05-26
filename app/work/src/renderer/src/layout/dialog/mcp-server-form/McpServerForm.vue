<script setup lang="ts">
import type { McpServerConfig } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@willow/shadcn/components/ui/dialog";
import { Input } from "@willow/shadcn/components/ui/input";
import { Label } from "@willow/shadcn/components/ui/label";
import { Textarea } from "@willow/shadcn/components/ui/textarea";
import { ref, onMounted } from "vue";
import { useMcpStore } from "@/stores/mcp";

const { mcpServer, workspaceId, onSaved } = defineProps<{
  mcpServer?: McpServerConfig;
  workspaceId?: number;
  onSaved?: () => void;
}>();

const emit = defineEmits<{
  close: [];
}>();

const mcpStore = useMcpStore();
const isValid = ref(true);
const loading = ref(false);

const form = ref({
  name: "",
  type: "stdio" as "stdio" | "sse",
  command: "",
  argsText: "",
  envText: "",
  url: "",
  disabled: false,
});

onMounted(() => {
  if (mcpServer) {
    form.value = {
      name: mcpServer.name,
      type: mcpServer.type,
      command: mcpServer.command || "",
      argsText: mcpServer.args ? mcpServer.args.join("\n") : "",
      envText: mcpServer.env
        ? Object.entries(mcpServer.env)
            .map(([k, v]) => `${k}=${v}`)
            .join("\n")
        : "",
      url: mcpServer.url || "",
      disabled: mcpServer.disabled ?? false,
    };
  }
});

async function handleSubmit() {
  if (!form.value.name.trim()) {
    isValid.value = false;
    return;
  }
  if (form.value.type === "stdio" && !form.value.command.trim()) {
    isValid.value = false;
    return;
  }
  if (form.value.type === "sse" && !form.value.url.trim()) {
    isValid.value = false;
    return;
  }

  isValid.value = true;
  loading.value = true;

  // Parse args
  const args = form.value.argsText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  // Parse env
  const env: Record<string, string> = {};
  form.value.envText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const idx = line.indexOf("=");
      if (idx !== -1) {
        const k = line.slice(0, idx).trim();
        const v = line.slice(idx + 1).trim();
        if (k) env[k] = v;
      }
    });

  const payload: McpServerConfig = {
    name: form.value.name.trim(),
    type: form.value.type,
    disabled: form.value.disabled,
    ...(form.value.type === "stdio"
      ? { command: form.value.command.trim(), args, env }
      : { url: form.value.url.trim() }),
  };

  try {
    if (mcpServer) {
      await mcpStore.updateServer(workspaceId, payload);
    } else {
      await mcpStore.addServer(workspaceId, payload);
    }
    onSaved?.();
    emit("close");
  } catch (e) {
    console.error(e);
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <DialogHeader>
    <DialogTitle>{{ mcpServer ? "编辑 MCP 服务" : "添加 MCP 服务" }}</DialogTitle>
    <DialogDescription> 配置并连接到 Model Context Protocol (MCP) 服务 </DialogDescription>
  </DialogHeader>

  <form class="grid gap-4 py-4" @submit.prevent="handleSubmit">
    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">名称</Label>
      <Input
        v-model="form.name"
        class="col-span-3"
        placeholder="e.g. memory-server"
        :disabled="!!mcpServer"
      />
    </div>

    <div class="grid grid-cols-4 items-center gap-4">
      <Label class="text-right text-sm">类型</Label>
      <div class="col-span-3 flex gap-4">
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" v-model="form.type" value="stdio" :disabled="!!mcpServer" /> Stdio
          (子进程)
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="radio" v-model="form.type" value="sse" :disabled="!!mcpServer" /> SSE (HTTP
          Endpoint)
        </label>
      </div>
    </div>

    <template v-if="form.type === 'stdio'">
      <div class="grid grid-cols-4 items-center gap-4">
        <Label class="text-right text-sm">命令</Label>
        <Input v-model="form.command" class="col-span-3" placeholder="e.g. node or python" />
      </div>

      <div class="grid grid-cols-4 items-start gap-4">
        <Label class="pt-2 text-right text-sm">参数</Label>
        <Textarea
          v-model="form.argsText"
          class="col-span-3"
          placeholder="一行一个参数，例如：&#10;/path/to/server.js&#10;--flag"
          rows="3"
        />
      </div>

      <div class="grid grid-cols-4 items-start gap-4">
        <Label class="pt-2 text-right text-sm">环境变量</Label>
        <Textarea
          v-model="form.envText"
          class="col-span-3"
          placeholder="一行一个键值对，例如：&#10;API_KEY=your_key&#10;PORT=8080"
          rows="3"
        />
      </div>
    </template>

    <template v-else-if="form.type === 'sse'">
      <div class="grid grid-cols-4 items-center gap-4">
        <Label class="text-right text-sm">SSE URL</Label>
        <Input v-model="form.url" class="col-span-3" placeholder="e.g. http://localhost:3000/sse" />
      </div>
    </template>

    <p v-if="!isValid" class="text-center text-sm text-destructive">请检查并填写必填字段</p>

    <DialogFooter>
      <Button type="button" variant="outline" @click="emit('close')">取消</Button>
      <Button type="submit" :disabled="loading">{{ mcpServer ? "保存" : "添加" }}</Button>
    </DialogFooter>
  </form>
</template>
