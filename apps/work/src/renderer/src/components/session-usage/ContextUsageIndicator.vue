<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@willow/shadcn/components/ui/tooltip";
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

const contextProgress = computed(() =>
  Math.min(100, Math.max(0, currentUsage.value.contextRatio * 100)),
);

const radius = 6;
const circumference = 2 * Math.PI * radius;
const strokeDashoffset = computed(() => circumference * (1 - contextProgress.value / 100));

const formattedContextTokens = computed(() => formatTokenCount(currentUsage.value.contextTokens));
const formattedContextLimit = computed(() =>
  currentUsage.value.contextWindow > 0 ? formatTokenCount(currentUsage.value.contextWindow) : "--",
);
const formattedRatio = computed(() => formatPercent(currentUsage.value.contextRatio));

const tooltipText = computed(() => {
  if (currentUsage.value.contextWindow > 0) {
    return `上下文大小: ${formattedContextTokens.value} / ${formattedContextLimit.value} (${formattedRatio.value})`;
  }
  return `上下文大小: ${formattedContextTokens.value} / --`;
});
</script>

<template>
  <TooltipProvider :delay-duration="150">
    <Tooltip>
      <TooltipTrigger as-child>
        <div
          class="inline-flex size-7 shrink-0 cursor-default items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none"
          data-slot="context-usage-indicator"
          tabindex="0"
          role="progressbar"
          :aria-valuenow="contextProgress"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="tooltipText"
        >
          <svg class="size-4" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <!-- Background Track -->
            <circle
              cx="8"
              cy="8"
              :r="radius"
              stroke="currentColor"
              class="text-muted-foreground/20"
              stroke-width="1.75"
            />
            <!-- Progress Arc -->
            <circle
              cx="8"
              cy="8"
              :r="radius"
              stroke="currentColor"
              class="text-foreground/75 transition-[stroke-dashoffset] duration-300"
              :class="{
                'text-amber-500': contextProgress >= 80 && contextProgress < 95,
                'text-destructive': contextProgress >= 95,
              }"
              stroke-width="1.75"
              stroke-linecap="round"
              :stroke-dasharray="circumference"
              :stroke-dashoffset="strokeDashoffset"
              transform="rotate(-90 8 8)"
            />
          </svg>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" :side-offset="6" class="px-2.5 py-1 text-xs tabular-nums">
        <p class="font-medium">{{ tooltipText }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</template>
