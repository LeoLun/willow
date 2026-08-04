<script setup lang="ts">
import { CircleAlert } from "lucide-vue-next";
import { computed } from "vue";
import ContentBlocks from "../blocks/ContentBlocks.vue";
import MessageToolbar from "../MessageToolbar.vue";
import type { Message } from "../types";

const props = withDefaults(
  defineProps<{
    message: Message;
    showToolbar?: boolean;
  }>(),
  {
    showToolbar: false,
  },
);

const failureMessage = computed(() => {
  if (props.message.stopReason !== "error") return undefined;
  return props.message.errorMessage?.trim() || "模型服务请求失败，请重试。";
});
</script>

<template>
  <article
    class="flex justify-start"
    data-slot="assistant-message"
    :data-message-role="props.message.role"
    :data-message-status="props.message.status"
  >
    <div class="flex w-full flex-col gap-2 rounded-2xl text-sm text-card-foreground">
      <div
        v-if="failureMessage"
        class="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-destructive"
        role="alert"
        data-slot="assistant-error"
      >
        <CircleAlert class="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <div class="min-w-0">
          <p class="font-medium">模型服务请求失败</p>
          <p class="mt-1 break-words whitespace-pre-wrap">{{ failureMessage }}</p>
        </div>
      </div>
      <ContentBlocks :message="props.message" markdown />
      <MessageToolbar v-if="props.showToolbar" :message="props.message" />
    </div>
  </article>
</template>
