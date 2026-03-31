<script setup lang="ts">
import { ChevronRight } from "lucide-vue-next";
import { ref } from "vue";
import { i18n } from "../utils/i18n";
import MarkdownBlock from "./MarkdownBlock.vue";

defineProps<{
  content: string;
  isStreaming?: boolean;
}>();

const isExpanded = ref(false);

function toggleExpanded() {
  isExpanded.value = !isExpanded.value;
}
</script>

<template>
  <div class="thinking-block">
    <div
      class="thinking-header flex cursor-pointer items-center gap-2 py-1 text-sm text-muted-foreground transition-colors select-none hover:text-foreground"
      @click="toggleExpanded"
    >
      <span class="inline-block transition-transform" :class="{ 'rotate-90': isExpanded }">
        <ChevronRight class="h-4 w-4" />
      </span>
      <span
        :class="
          isStreaming
            ? 'animate-shimmer bg-gradient-to-r from-muted-foreground via-foreground to-muted-foreground bg-[length:200%_100%] bg-clip-text text-transparent'
            : ''
        "
      >
        {{ isStreaming ? i18n("thinking") : i18n("thinking_completed") }}
      </span>
    </div>
    <MarkdownBlock v-if="isExpanded" :content="content" :is-thinking="true" />
  </div>
</template>
