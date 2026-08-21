<script setup lang="ts">
import type {
  GetStatisticsResponse,
  StatisticsActivityBucket,
  StatisticsGranularity,
} from "@shared/api";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@willow/shadcn/components/ui/tooltip";
import { CircleAlert, LoaderCircle } from "lucide-vue-next";
import { computed, ref, shallowRef, watch } from "vue";
import { Button } from "@/components/ui/button";
import { electronAPI } from "@/lib/ipc";
import ProviderMark from "./ProviderMark.vue";
import { getTokenHeatLevel } from "./statistics-heatmap";

const rangeOptions: Array<{ id: StatisticsGranularity; label: string }> = [
  { id: "daily", label: "每日" },
  { id: "weekly", label: "每周" },
  { id: "all", label: "累计" },
];

const heatCellClasses = [
  "bg-muted/70",
  "bg-primary/10",
  "bg-primary/20",
  "bg-primary/30",
  "bg-primary/40",
  "bg-primary/50",
  "bg-primary/60",
  "bg-primary/70",
  "bg-primary/80",
  "bg-primary/90",
  "bg-primary",
];

const tokenFormatter = new Intl.NumberFormat("zh-CN");
const compactTokenFormatter = new Intl.NumberFormat("zh-CN", {
  notation: "compact",
  maximumFractionDigits: 1,
});
const percentageFormatter = new Intl.NumberFormat("zh-CN", {
  style: "percent",
  maximumFractionDigits: 0,
});
const dailyDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});
const shortDateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});
const monthFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "short",
  timeZone: "UTC",
});

const activeRange = ref<StatisticsGranularity>("daily");
const statistics = shallowRef<GetStatisticsResponse>();
const loading = ref(false);
const loadError = ref("");
let requestGeneration = 0;

const currentStatistics = computed(() =>
  statistics.value?.granularity === activeRange.value ? statistics.value : undefined,
);
const activityPoints = computed(() => {
  const buckets = currentStatistics.value?.activityBuckets ?? [];
  return buckets.map((bucket) => ({
    ...bucket,
    level: getTokenHeatLevel(bucket.totalTokens),
  }));
});
const summaryMetrics = computed(() => {
  const summary = currentStatistics.value?.summary;
  return [
    {
      value: compactTokenFormatter.format(summary?.totalTokens ?? 0),
      label: "累计 Token 数",
    },
    {
      value: compactTokenFormatter.format(summary?.cacheReadTokens ?? 0),
      label: "缓存 Token 数",
    },
    { value: tokenFormatter.format(summary?.totalTasks ?? 0), label: "任务总数" },
  ];
});
const modelUsage = computed(() => currentStatistics.value?.modelUsage ?? []);
const hasStatistics = computed(() => {
  const summary = currentStatistics.value?.summary;
  return Boolean(summary && (summary.totalTokens > 0 || summary.totalTasks > 0));
});
const monthLabels = computed(() => {
  if (activeRange.value !== "daily" || activityPoints.value.length === 0) return [];
  return Array.from({ length: 12 }, (_, index) => {
    const pointIndex = Math.round((index * (activityPoints.value.length - 1)) / 11);
    return monthFormatter.format(new Date(activityPoints.value[pointIndex].startAt));
  });
});
const activityGridStyle = computed(() => {
  if (activeRange.value === "daily") {
    return {
      gridAutoFlow: "column",
      gridTemplateColumns: "repeat(53, minmax(0, 1fr))",
      gridTemplateRows: "repeat(7, minmax(0, 1fr))",
    };
  }
  if (activeRange.value === "weekly") {
    return { gridTemplateColumns: "repeat(13, minmax(0, 1fr))" };
  }
  return { gridTemplateColumns: "minmax(72px, 112px)" };
});

async function loadStatistics(granularity: StatisticsGranularity) {
  const generation = ++requestGeneration;
  loading.value = true;
  loadError.value = "";
  try {
    const response = await electronAPI.getStatistics({ granularity });
    if (generation === requestGeneration) {
      statistics.value = response;
    }
  } catch {
    if (generation === requestGeneration) {
      loadError.value = "无法读取统计数据，请重试。";
    }
  } finally {
    if (generation === requestGeneration) {
      loading.value = false;
    }
  }
}

function formatTokens(tokens: number): string {
  return `${tokenFormatter.format(tokens)} Token`;
}

function formatBucketLabel(bucket: StatisticsActivityBucket): string {
  if (activeRange.value === "all") return "全部时间";
  if (activeRange.value === "daily") {
    return dailyDateFormatter.format(new Date(bucket.startAt));
  }
  const inclusiveEnd = new Date(new Date(bucket.endAt).getTime() - 1);
  return `${shortDateFormatter.format(new Date(bucket.startAt))} – ${shortDateFormatter.format(inclusiveEnd)}`;
}

function getHeatCellClass(level: number): string {
  return heatCellClasses[level] ?? heatCellClasses[0];
}

function getPointAriaLabel(point: StatisticsActivityBucket): string {
  const label = formatBucketLabel(point);
  return point.totalTokens === 0
    ? `${label}，无 Token 使用`
    : `${label}，共 ${formatTokens(point.totalTokens)}`;
}

watch(activeRange, (granularity) => void loadStatistics(granularity), { immediate: true });
</script>

<template>
  <section class="h-full overflow-y-auto pr-1" aria-labelledby="statistics-heading">
    <header>
      <h2 id="statistics-heading" class="text-base font-semibold">统计</h2>
      <p class="mt-1 text-xs text-muted-foreground">了解 Willow 的 Token 使用情况。</p>
    </header>

    <div class="mt-4 grid grid-cols-3 divide-x rounded-xl border bg-muted/15 py-4">
      <div v-for="metric in summaryMetrics" :key="metric.label" class="px-3 text-center">
        <div class="text-lg font-semibold tracking-tight">{{ metric.value }}</div>
        <div class="mt-1 text-[11px] text-muted-foreground">{{ metric.label }}</div>
      </div>
    </div>

    <div
      v-if="loadError"
      class="mt-6 flex min-h-28 items-center justify-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-5 text-xs text-destructive"
      role="alert"
    >
      <CircleAlert class="size-4" aria-hidden="true" />
      <span>{{ loadError }}</span>
      <Button variant="secondary" size="sm" @click="loadStatistics(activeRange)">重试</Button>
    </div>

    <template v-else>
      <section class="mt-6" aria-labelledby="token-activity-heading">
        <div class="flex items-center justify-between">
          <h3 id="token-activity-heading" class="text-sm font-semibold">Token 活动</h3>
          <div class="flex items-center gap-1" aria-label="Token 活动粒度">
            <button
              v-for="option in rangeOptions"
              :key="option.id"
              type="button"
              class="rounded-md px-2 py-1 text-xs transition-colors disabled:opacity-50"
              :class="
                activeRange === option.id
                  ? 'bg-accent font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              "
              :aria-pressed="activeRange === option.id"
              @click="activeRange = option.id"
            >
              {{ option.label }}
            </button>
          </div>
        </div>

        <div
          v-if="loading && !currentStatistics"
          class="mt-3 flex min-h-48 items-center justify-center gap-2 text-xs text-muted-foreground"
          aria-live="polite"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
          正在读取统计数据…
        </div>

        <div
          v-else-if="!hasStatistics"
          class="mt-3 flex min-h-28 items-center justify-center rounded-xl border bg-muted/10 px-5 text-xs text-muted-foreground"
        >
          完成一次任务后，这里会显示 Token 使用情况。
        </div>

        <template v-else>
          <TooltipProvider :delay-duration="100" :skip-delay-duration="100">
            <div
              class="mt-3 grid gap-1 transition-opacity"
              :class="{ 'opacity-50': loading }"
              :style="activityGridStyle"
              :aria-label="
                activeRange === 'daily'
                  ? '过去 365 天的 Token 使用'
                  : activeRange === 'weekly'
                    ? '过去 52 周的 Token 使用'
                    : '累计 Token 使用'
              "
            >
              <Tooltip v-for="point in activityPoints" :key="point.key">
                <TooltipTrigger as-child>
                  <span
                    class="min-w-0 rounded-[3px] ring-ring transition-transform outline-none hover:scale-125 focus-visible:ring-2"
                    :class="[
                      getHeatCellClass(point.level),
                      activeRange === 'all' ? 'h-8' : 'aspect-square',
                    ]"
                    :tabindex="point.totalTokens > 0 ? 0 : -1"
                    :aria-label="getPointAriaLabel(point)"
                  ></span>
                </TooltipTrigger>
                <TooltipContent side="top" :side-offset="8" class="w-56 px-3 py-2.5 text-left">
                  <div class="flex items-center justify-between gap-3">
                    <span class="font-medium">{{ formatBucketLabel(point) }}</span>
                    <span class="tabular-nums">{{ formatTokens(point.totalTokens) }}</span>
                  </div>
                  <div
                    v-if="point.models.length"
                    class="mt-2 space-y-1.5 border-t border-background/20 pt-2"
                  >
                    <div
                      v-for="model in point.models"
                      :key="`${model.providerId}:${model.modelId}`"
                      class="flex items-center justify-between gap-3"
                    >
                      <span class="truncate text-background/75">{{ model.modelName }}</span>
                      <span class="shrink-0 tabular-nums">{{
                        tokenFormatter.format(model.tokens)
                      }}</span>
                    </div>
                  </div>
                  <div v-else class="mt-2 border-t border-background/20 pt-2 text-background/70">
                    此时间段没有 Token 使用
                  </div>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
          <div
            v-if="monthLabels.length"
            class="mt-2 flex justify-between text-[10px] text-muted-foreground"
          >
            <span v-for="(month, index) in monthLabels" :key="`${month}:${index}`">{{
              month
            }}</span>
          </div>
        </template>
      </section>

      <section
        v-if="currentStatistics && hasStatistics"
        class="mt-6"
        aria-labelledby="model-usage-heading"
      >
        <div class="flex items-end justify-between">
          <div>
            <h3 id="model-usage-heading" class="text-sm font-semibold">模型使用情况</h3>
            <p class="mt-1 text-[11px] text-muted-foreground">按 Token 使用量排序</p>
          </div>
          <div
            class="mr-3 grid grid-cols-[76px_68px] text-right text-[10px] text-muted-foreground"
            aria-hidden="true"
          >
            <span>Token</span>
            <span>缓存占比</span>
          </div>
        </div>

        <div class="mt-3 divide-y rounded-xl border bg-muted/10">
          <div
            v-for="usage in modelUsage"
            :key="`${usage.providerId}:${usage.modelId}`"
            class="flex items-center gap-3 px-3 py-2.5"
          >
            <ProviderMark :provider-id="usage.providerId" :name="usage.providerName" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-xs font-medium">{{ usage.modelName }}</div>
              <div class="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  class="h-full rounded-full bg-primary"
                  :style="{ width: `${usage.share * 100}%` }"
                ></div>
              </div>
            </div>
            <div class="grid grid-cols-[76px_68px] text-right text-xs tabular-nums">
              <span>{{ compactTokenFormatter.format(usage.totalTokens) }}</span>
              <span class="text-muted-foreground">{{
                percentageFormatter.format(usage.cacheRatio)
              }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </section>
</template>
