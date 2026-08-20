<script setup lang="ts">
import { computed, inject, ref, watch } from "vue";
import { SESSION_USAGE_KEY } from "./context";
import { formatPercent, formatTokenCount, type SessionUsageSummary } from "./session-usage";

const props = defineProps<{
  usage?: SessionUsageSummary;
}>();

const injectedUsage = inject(SESSION_USAGE_KEY, undefined);

const defaultUsage: SessionUsageSummary = {
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

const rawUsage = computed<SessionUsageSummary>(() => {
  if (props.usage) return props.usage;
  if (injectedUsage?.value) return injectedUsage.value;
  return defaultUsage;
});

const isVisible = computed(() => {
  const usage = rawUsage.value;
  return usage.turns > 0 || usage.steps > 0 || usage.totalTokens > 0;
});

// Preserve last valid usage during transitions so numbers do not flash to 0 before fading out
const displayedUsage = ref<SessionUsageSummary>(isVisible.value ? rawUsage.value : defaultUsage);

watch(
  rawUsage,
  (next) => {
    if (next.turns > 0 || next.steps > 0 || next.totalTokens > 0) {
      displayedUsage.value = next;
    }
  },
  { deep: true },
);
</script>

<template>
  <div
    class="mt-2 flex h-4 items-center justify-center gap-2.5 text-xs text-muted-foreground tabular-nums transition-[opacity,transform] duration-100 ease-out select-none"
    :class="
      isVisible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-0 opacity-0'
    "
    :aria-hidden="!isVisible"
    data-slot="session-usage-bar"
    aria-label="会话用量信息"
  >
    <span>{{ displayedUsage.turns }} 轮 · {{ displayedUsage.steps }} 步</span>
    <span class="text-muted-foreground/30" aria-hidden="true">|</span>
    <span>缓存命中 {{ formatPercent(displayedUsage.cacheRatio) }}</span>
    <span class="text-muted-foreground/30" aria-hidden="true">|</span>
    <span>
      输入 {{ formatTokenCount(displayedUsage.inputTokens) }} token · 输出
      {{ formatTokenCount(displayedUsage.outputTokens) }} token
    </span>
  </div>
</template>
