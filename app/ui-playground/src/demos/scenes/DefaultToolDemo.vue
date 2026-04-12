<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import { defaultToolCall, defaultToolResult } from "../mock-data";
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div>
      <h3 class="text-sm font-semibold text-foreground">Default Fallback</h3>
      <p class="mt-1 text-sm text-muted-foreground">检查没有专用 renderer 时的默认降级表现。</p>
    </div>
    <ToolMessage :tool-call="defaultToolCall" :result="defaultToolResult" />
  </div>
</template>
