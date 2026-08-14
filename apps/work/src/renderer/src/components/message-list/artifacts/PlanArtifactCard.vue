<script setup lang="ts">
import type { TurnPlanArtifact } from "@shared/api";
import { PanelRightOpen, ScrollText } from "lucide-vue-next";
import { requestPlanPreview } from "@/lib/app-state-events";
import MarkdownBlock from "../blocks/MarkdownBlock.vue";

const props = defineProps<{ plan: TurnPlanArtifact }>();

function openInSidebar(): void {
  requestPlanPreview(props.plan);
}
</script>

<template>
  <section
    class="overflow-hidden rounded-xl border border-border/80 bg-card"
    data-slot="plan-artifact-card"
  >
    <header class="flex min-h-12 items-center gap-2 border-b px-3 py-2">
      <ScrollText class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="min-w-0 flex-1 truncate font-medium" :title="props.plan.path">
        {{ props.plan.fileName }}
      </span>
      <button
        type="button"
        class="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label="在右侧边栏查看完整 Plan"
        @click="openInSidebar"
      >
        查看完整内容
        <PanelRightOpen class="size-3.5" aria-hidden="true" />
      </button>
    </header>
    <div class="relative max-h-60 overflow-hidden px-4 py-4" data-slot="plan-artifact-preview">
      <MarkdownBlock :content="props.plan.content" />
      <div
        class="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-b from-transparent to-card"
        data-slot="plan-artifact-gradient"
        aria-hidden="true"
      />
    </div>
  </section>
</template>
