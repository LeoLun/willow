<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import { automationCreateResult, automationCreateToolCall, demoTools } from "../mock-data";
</script>

<template>
  <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
    <div>
      <h3 class="text-sm font-semibold text-foreground">自动化创建</h3>
      <p class="mt-1 text-sm text-muted-foreground">检查标题、计划表达和打开按钮的视觉层级。</p>
    </div>
    <ToolMessage
      :tool="demoTools[5]"
      :tool-call="automationCreateToolCall"
      :result="automationCreateResult"
    />
  </div>
</template>
