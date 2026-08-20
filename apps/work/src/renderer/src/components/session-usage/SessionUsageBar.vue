<script setup lang="ts">
import { computed, inject } from "vue";
import { SESSION_USAGE_KEY } from "./context";
import { formatPercent, formatTokenCount, type SessionUsageSummary } from "./session-usage";

const props = defineProps<{
  usage?: SessionUsageSummary;
}>();

const injectedUsage = inject(SESSION_USAGE_KEY, undefined);

const currentUsage = computed<SessionUsageSummary>(() => {
  if (props.usage) return props.usage;
  if (injectedUsage?.value) return injectedUsage.value;
  return {
    turns: 0,
    steps: 0,
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    cacheReadTokens: 0,
    cacheRatio: 0,
    contextTokens: 0,
    contextWindow: 0,
    contextRatio: 0,
  };
});

const isVisible = computed(() => {
  const usage = currentUsage.value;
  return usage.turns > 0 || usage.steps > 0 || usage.totalTokens > 0;
});
</script>

<template>
  <div
    class="mt-2 flex items-center justify-center gap-2.5 text-xs text-muted-foreground tabular-nums select-none"
    data-slot="session-usage-bar"
    aria-label="会话用量信息"
  >
    <span>{{ currentUsage.turns }} 轮 · {{ currentUsage.steps }} 步</span>
    <span class="text-muted-foreground/30" aria-hidden="true">|</span>
    <span>缓存命中 {{ formatPercent(currentUsage.cacheRatio) }}</span>
    <span class="text-muted-foreground/30" aria-hidden="true">|</span>
    <span>
      输入 {{ formatTokenCount(currentUsage.inputTokens) }} token · 输出
      {{ formatTokenCount(currentUsage.outputTokens) }} token
    </span>
  </div>
</template>
