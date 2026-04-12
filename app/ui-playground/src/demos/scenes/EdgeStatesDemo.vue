<script setup lang="ts">
import { AssistantMessage, MarkdownBlock, UserMessage } from "@willow/ui";
import { errorAssistantMessage, longUserMessage, markdownSample } from "../mock-data";
</script>

<template>
  <div class="grid gap-4">
    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">长内容与多行换行</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          观察窄容器下的阅读节奏、段落边距和换行稳定性。
        </p>
      </div>
      <UserMessage :message="longUserMessage" />
      <div class="rounded-xl border border-dashed border-border bg-muted/35 p-4">
        <MarkdownBlock :content="markdownSample" />
      </div>
    </div>

    <div class="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-sm">
      <div>
        <h3 class="text-sm font-semibold text-foreground">错误态</h3>
        <p class="mt-1 text-sm text-muted-foreground">检查错误条、正文和危险色块的层级是否清晰。</p>
      </div>
      <AssistantMessage :message="errorAssistantMessage" />
    </div>
  </div>
</template>
