<script setup lang="ts">
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@willow/shadcn/components/ui/tooltip";
import { computed, ref } from "vue";
import ProviderMark from "./ProviderMark.vue";

type ActivityRange = "daily" | "weekly" | "all";

interface ActivityModelUsage {
  model: string;
  tokens: number;
}

interface ActivityPoint {
  date: string;
  level: number;
  models: ActivityModelUsage[];
  totalTokens: number;
}

interface ModelUsage {
  providerId: string;
  providerName: string;
  model: string;
  tokens: string;
  cacheRatio: string;
  cost: string;
  share: number;
}

const summaryMetrics = [
  { value: "128.6 万", label: "累计 Token 数" },
  { value: "57.6 万", label: "缓存 Token 数" },
  { value: "126", label: "任务总数" },
  { value: "$38.72", label: "累计费用" },
];

const rangeOptions: Array<{ id: ActivityRange; label: string }> = [
  { id: "daily", label: "每日" },
  { id: "weekly", label: "每周" },
  { id: "all", label: "累计" },
];

const monthLabels = [
  "8月",
  "9月",
  "10月",
  "11月",
  "12月",
  "1月",
  "2月",
  "3月",
  "4月",
  "5月",
  "6月",
  "7月",
];

const modelUsage: ModelUsage[] = [
  {
    providerId: "openai",
    providerName: "OpenAI",
    model: "GPT-5.4",
    tokens: "56.8 万",
    cacheRatio: "48%",
    cost: "$19.84",
    share: 44,
  },
  {
    providerId: "anthropic",
    providerName: "Anthropic",
    model: "Claude Sonnet 4.5",
    tokens: "34.2 万",
    cacheRatio: "41%",
    cost: "$11.26",
    share: 27,
  },
  {
    providerId: "google",
    providerName: "Google",
    model: "Gemini 2.5 Pro",
    tokens: "23.7 万",
    cacheRatio: "52%",
    cost: "$5.48",
    share: 18,
  },
  {
    providerId: "openai",
    providerName: "OpenAI",
    model: "GPT-5.4 mini",
    tokens: "13.9 万",
    cacheRatio: "29%",
    cost: "$2.14",
    share: 11,
  },
];

const heatCellClasses = [
  "bg-muted/70",
  "bg-blue-100 dark:bg-blue-950",
  "bg-blue-200 dark:bg-blue-900",
  "bg-blue-400 dark:bg-blue-700",
  "bg-blue-600 dark:bg-blue-500",
];

const tokenFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "long",
  day: "numeric",
  weekday: "short",
  timeZone: "UTC",
});

function buildModelBreakdown(
  index: number,
  seed: number,
  totalTokens: number,
): ActivityModelUsage[] {
  if (totalTokens === 0) return [];

  const activeModels = modelUsage.filter((_, modelIndex) => (index + modelIndex + seed) % 3 !== 0);
  const totalShare = activeModels.reduce((sum, model) => sum + model.share, 0);
  let allocatedTokens = 0;

  return activeModels.map((model, modelIndex) => {
    const isLast = modelIndex === activeModels.length - 1;
    const tokens = isLast
      ? totalTokens - allocatedTokens
      : Math.round((totalTokens * model.share) / totalShare);
    allocatedTokens += tokens;
    return { model: model.model, tokens };
  });
}

function buildActivity(
  seed: number,
  activeWeeks: number,
  tokenMultiplier: number,
): ActivityPoint[] {
  return Array.from({ length: 52 * 7 }, (_, index) => {
    const week = Math.floor(index / 7);
    const day = index % 7;
    const isRecent = week >= 52 - activeWeeks;
    let level: number;

    if (!isRecent) {
      level = (week * 7 + day * 3 + seed) % 47 === 0 ? 1 : 0;
    } else {
      const activity = (week * 5 + day * 3 + seed) % 13;
      if (activity < 3) level = 0;
      else if (activity < 7) level = 1;
      else if (activity < 10) level = 2;
      else if (activity < 12) level = 3;
      else level = 4;
    }

    const totalTokens =
      level === 0 ? 0 : (level * 1550 + ((index * 193 + seed * 97) % 900)) * tokenMultiplier;
    const date = new Date(Date.UTC(2025, 6, 27 + index));

    return {
      date: dateFormatter.format(date),
      level,
      models: buildModelBreakdown(index, seed, totalTokens),
      totalTokens,
    };
  });
}

const activityByRange: Record<ActivityRange, ActivityPoint[]> = {
  daily: buildActivity(2, 12, 1),
  weekly: buildActivity(5, 26, 4),
  all: buildActivity(8, 52, 8),
};

const activeRange = ref<ActivityRange>("daily");
const activityPoints = computed(() => activityByRange[activeRange.value]);

function getHeatCellClass(level: number): string {
  return heatCellClasses[level] ?? heatCellClasses[0];
}

function formatTokens(tokens: number): string {
  return `${tokenFormatter.format(tokens)} Token`;
}

function getPointAriaLabel(point: ActivityPoint): string {
  return point.totalTokens === 0
    ? `${point.date}，无 Token 使用`
    : `${point.date}，共 ${formatTokens(point.totalTokens)}`;
}
</script>

<template>
  <section class="h-full overflow-y-auto pr-1" aria-labelledby="statistics-heading">
    <header>
      <h2 id="statistics-heading" class="text-base font-semibold">统计</h2>
      <p class="mt-1 text-xs text-muted-foreground">了解 Willow 的 Token 使用和模型费用。</p>
    </header>

    <div class="mt-4 grid grid-cols-4 divide-x rounded-xl border bg-muted/15 py-4">
      <div v-for="metric in summaryMetrics" :key="metric.label" class="px-3 text-center">
        <div class="text-lg font-semibold tracking-tight">{{ metric.value }}</div>
        <div class="mt-1 text-[11px] text-muted-foreground">{{ metric.label }}</div>
      </div>
    </div>

    <section class="mt-6" aria-labelledby="token-activity-heading">
      <div class="flex items-center justify-between">
        <h3 id="token-activity-heading" class="text-sm font-semibold">Token 活动</h3>
        <div class="flex items-center gap-1" aria-label="Token 活动范围">
          <button
            v-for="option in rangeOptions"
            :key="option.id"
            type="button"
            class="rounded-md px-2 py-1 text-xs transition-colors"
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

      <TooltipProvider :delay-duration="100" :skip-delay-duration="100">
        <div
          class="mt-3 grid auto-cols-fr grid-flow-col grid-rows-7 gap-1"
          aria-label="过去一年的 Token 使用热力图"
        >
          <Tooltip v-for="(point, index) in activityPoints" :key="index">
            <TooltipTrigger as-child>
              <span
                class="aspect-square min-w-0 rounded-[3px] ring-blue-500 transition-transform outline-none hover:scale-125 focus-visible:ring-2"
                :class="getHeatCellClass(point.level)"
                :tabindex="point.totalTokens > 0 ? 0 : -1"
                :aria-label="getPointAriaLabel(point)"
              ></span>
            </TooltipTrigger>
            <TooltipContent side="top" :side-offset="8" class="w-56 px-3 py-2.5 text-left">
              <div class="flex items-center justify-between gap-3">
                <span class="font-medium">{{ point.date }}</span>
                <span class="tabular-nums">{{ formatTokens(point.totalTokens) }}</span>
              </div>
              <div
                v-if="point.models.length"
                class="mt-2 space-y-1.5 border-t border-background/20 pt-2"
              >
                <div
                  v-for="model in point.models"
                  :key="model.model"
                  class="flex items-center justify-between gap-3"
                >
                  <span class="truncate text-background/75">{{ model.model }}</span>
                  <span class="shrink-0 tabular-nums">{{
                    tokenFormatter.format(model.tokens)
                  }}</span>
                </div>
              </div>
              <div v-else class="mt-2 border-t border-background/20 pt-2 text-background/70">
                当天没有 Token 使用
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
      <div class="mt-2 flex justify-between text-[10px] text-muted-foreground">
        <span v-for="month in monthLabels" :key="month">{{ month }}</span>
      </div>
    </section>

    <section class="mt-6" aria-labelledby="model-usage-heading">
      <div class="flex items-end justify-between">
        <div>
          <h3 id="model-usage-heading" class="text-sm font-semibold">模型使用情况</h3>
          <p class="mt-1 text-[11px] text-muted-foreground">按 Token 使用量排序</p>
        </div>
        <div
          class="grid grid-cols-[76px_68px_64px] text-right text-[10px] text-muted-foreground"
          aria-hidden="true"
        >
          <span>Token</span>
          <span>缓存占比</span>
          <span>费用</span>
        </div>
      </div>

      <div class="mt-3 divide-y rounded-xl border bg-muted/10">
        <div
          v-for="usage in modelUsage"
          :key="usage.model"
          class="flex items-center gap-3 px-3 py-2.5"
        >
          <ProviderMark :provider-id="usage.providerId" :name="usage.providerName" />
          <div class="min-w-0 flex-1">
            <div class="truncate text-xs font-medium">{{ usage.model }}</div>
            <div class="mt-1 h-1 overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-blue-500"
                :style="{ width: `${usage.share}%` }"
              ></div>
            </div>
          </div>
          <div class="grid grid-cols-[76px_68px_64px] text-right text-xs tabular-nums">
            <span>{{ usage.tokens }}</span>
            <span class="text-muted-foreground">{{ usage.cacheRatio }}</span>
            <span>{{ usage.cost }}</span>
          </div>
        </div>
      </div>
    </section>
  </section>
</template>
