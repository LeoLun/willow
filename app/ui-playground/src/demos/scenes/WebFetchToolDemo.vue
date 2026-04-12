<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import { demoTools, webFetchResult, webFetchToolCall } from "../mock-data";
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div>
      <h3 class="text-sm font-semibold text-foreground">网页抓取结果</h3>
      <p class="mt-1 text-sm text-muted-foreground">
        检查 URL 摘要、参数展开与 Markdown 预览内容。
      </p>
    </div>
    <ToolMessage :tool="demoTools[2]" :tool-call="webFetchToolCall" :result="webFetchResult" />
  </div>
</template>
