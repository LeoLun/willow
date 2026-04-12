<script setup lang="ts">
import { ToolMessage } from "@willow/ui";
import {
  conversationMessages,
  demoTools,
  failedBashResult,
  failedBashToolCall,
} from "../mock-data";

const assistantMessage = conversationMessages.find((message) => message.role === "assistant");
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">成功态</h3>
        <p class="mt-1 text-sm text-muted-foreground">检查命令摘要、输出块和完成状态。</p>
      </div>
      <ToolMessage
        :tool="demoTools[0]"
        :tool-call="assistantMessage!.content[2]"
        :result="conversationMessages[2]"
      />
    </div>

    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">失败态</h3>
        <p class="mt-1 text-sm text-muted-foreground">检查错误输出、边框和长文本表现。</p>
      </div>
      <ToolMessage
        :tool="demoTools[0]"
        :tool-call="failedBashToolCall"
        :result="failedBashResult"
      />
    </div>
  </div>
</template>
