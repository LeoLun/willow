<script setup lang="ts">
import MarkdownBlock from "@/components/message-list/blocks/MarkdownBlock.vue";
import type { PlanPanelState } from "./types";

const props = defineProps<{
  state: PlanPanelState;
}>();
</script>

<template>
  <div class="h-full min-h-0 overflow-y-auto px-5 py-4" data-slot="right-sidebar-plan-panel">
    <MarkdownBlock v-if="props.state.plan" :content="props.state.plan.content" />
    <p v-else class="text-sm text-muted-foreground">没有可展示的 Plan。</p>
  </div>
</template>
