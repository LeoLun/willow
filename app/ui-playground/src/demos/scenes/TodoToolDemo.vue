<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import {
  demoTools,
  todoReadResult,
  todoReadToolCall,
  todoWriteResult,
  todoWriteToolCall,
} from "../mock-data";
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">Todo Read</h3>
        <p class="mt-1 text-sm text-muted-foreground">检查读取待办列表时的进度摘要和折叠明细。</p>
      </div>
      <ToolMessage :tool="demoTools[3]" :tool-call="todoReadToolCall" :result="todoReadResult" />
    </div>

    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">Todo Write</h3>
        <p class="mt-1 text-sm text-muted-foreground">检查写入待办列表后的计数和状态图标层级。</p>
      </div>
      <ToolMessage :tool="demoTools[4]" :tool-call="todoWriteToolCall" :result="todoWriteResult" />
    </div>
  </div>
</template>
