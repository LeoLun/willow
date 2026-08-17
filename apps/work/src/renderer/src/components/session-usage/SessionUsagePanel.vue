<script setup lang="ts">
import { Progress } from "@willow/shadcn/components/ui/progress";
import { Database, Gauge, Sparkles } from "lucide-vue-next";
import { computed, inject } from "vue";
import { SESSION_USAGE_KEY } from "./context";

const compactFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percentFormatter = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 0,
});

const usage = inject(SESSION_USAGE_KEY);
if (!usage) throw new Error("SessionUsagePanel must be used inside a session usage provider");

const contextProgress = computed(() => Math.min(100, Math.max(0, usage.value.contextRatio * 100)));
const contextLimit = computed(() =>
  usage.value.contextWindow > 0 ? compactFormatter.format(usage.value.contextWindow) : "--",
);
</script>

<template>
  <section
    class="h-auto min-h-0 overflow-y-auto rounded-3xl border bg-background p-5 shadow-sm"
    data-slot="session-usage-panel"
    aria-label="会话用量"
  >
    <div>
      <div class="flex items-center gap-2 text-xs font-medium">
        <Sparkles class="size-3.5 text-muted-foreground" aria-hidden="true" />
        Token
      </div>
      <p class="mt-3 text-base font-semibold tracking-tight tabular-nums">
        {{ compactFormatter.format(usage.totalTokens) }}
      </p>
      <div class="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span class="flex items-center gap-1.5">
          <Database class="size-3.5" aria-hidden="true" />
          缓存比例
        </span>
        <span class="font-medium text-foreground tabular-nums">
          {{ percentFormatter.format(usage.cacheRatio) }}
        </span>
      </div>
    </div>

    <div class="mt-3 border-t pt-3">
      <div class="flex items-center gap-2 text-xs font-medium">
        <Gauge class="size-3.5 text-muted-foreground" aria-hidden="true" />
        上下文大小
      </div>
      <div class="mt-3 flex items-end justify-between gap-3">
        <p class="text-base font-semibold tracking-tight tabular-nums">
          {{ compactFormatter.format(usage.contextTokens) }}
          <span class="text-base font-normal text-muted-foreground">/ {{ contextLimit }}</span>
        </p>
        <span class="pb-0.5 text-xs font-medium tabular-nums">
          {{ percentFormatter.format(usage.contextRatio) }}
        </span>
      </div>
      <Progress
        :model-value="contextProgress"
        class="mt-2 h-1.5 bg-muted"
        aria-label="上下文使用比例"
      />
    </div>
  </section>
</template>
