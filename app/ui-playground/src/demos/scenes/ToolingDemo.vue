<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import {
  failedBashResult,
  failedBashToolCall,
  webSearchResult,
  webSearchToolCall,
} from "../mock-data";
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">成功结果</h3>
        <p class="mt-1 text-sm text-muted-foreground">用于观察工具摘要、展开区与 JSON 输出层级。</p>
      </div>
      <ToolMessage :tool-call="webSearchToolCall" :result="webSearchResult" />
    </div>

    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">错误结果</h3>
        <p class="mt-1 text-sm text-muted-foreground">用于检查错误状态、长文本和边框颜色表现。</p>
      </div>
      <ToolMessage :tool-call="failedBashToolCall" :result="failedBashResult" />
    </div>
  </div>
</template>
