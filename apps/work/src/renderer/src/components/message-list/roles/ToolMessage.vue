<script setup lang="ts">
import ContentBlocks from "../blocks/ContentBlocks.vue";
import ToolResultBlock from "../blocks/ToolResultBlock.vue";
import type { Message } from "../types";

const props = defineProps<{
  message: Message;
}>();
</script>

<template>
  <article
    class="flex justify-start"
    data-slot="tool-result"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div
      class="flex max-w-[85%] flex-col gap-2 rounded-2xl border bg-card px-4 py-3 text-sm text-card-foreground"
      :class="props.message.isError ? 'border-destructive/40 bg-destructive/5' : ''"
    >
      <div class="flex items-center gap-2 text-xs opacity-70">
        <span> 工具结果{{ props.message.toolName ? ` · ${props.message.toolName}` : "" }} </span>
        <span>{{ props.message.isError ? "失败" : "完成" }}</span>
        <span v-if="props.message.status === 'streaming'">生成中…</span>
      </div>

      <ContentBlocks :message="props.message" />
      <ToolResultBlock
        v-if="props.message.details !== undefined"
        :details="props.message.details"
      />
    </div>
  </article>
</template>
