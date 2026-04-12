<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import { demoTools, webSearchResult, webSearchToolCall } from "../mock-data";
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div>
      <h3 class="text-sm font-semibold text-foreground">搜索结果摘要</h3>
      <p class="mt-1 text-sm text-muted-foreground">检查站点 pill、展开区和 Markdown 输出。</p>
    </div>
    <ToolMessage :tool="demoTools[1]" :tool-call="webSearchToolCall" :result="webSearchResult" />
  </div>
</template>
