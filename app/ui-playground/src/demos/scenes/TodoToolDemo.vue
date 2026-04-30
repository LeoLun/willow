<script setup lang="ts">
import { ChevronRight, ListChecks } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";

const todoSamples = [
  {
    title: "Todo Read",
    description: "检查读取待办列表时的进度摘要和折叠明细。",
    action: "读取待办列表",
    summary: "为每一种工具调用补充 demo",
    stats: "1/3 · 1 项进行中 · 1 项待处理",
  },
  {
    title: "Todo Write",
    description: "检查写入待办列表后的计数和状态图标层级。",
    action: "更新待办列表",
    summary: "共 3 项待办",
    stats: "2/3 · 1 项待处理",
  },
] as const;
</script>

<template>
  <ToolGallerySection title="Todo" description="任务列表类工具，适合检查计数、状态图标和展开明细。">
    <div class="grid gap-5">
      <ToolSampleCard
        v-for="sample in todoSamples"
        :key="sample.title"
        :title="sample.title"
        :description="sample.description"
      >
        <div class="rounded-lg border border-border bg-card px-3 py-2">
          <div class="flex min-w-0 items-start justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-start gap-2">
              <ListChecks class="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <div class="min-w-0 flex-1 space-y-2">
                <p class="truncate text-sm leading-[1.4286] font-medium text-foreground">
                  {{ sample.action }}
                </p>
                <p class="truncate text-sm leading-[1.4286] font-semibold text-foreground">
                  {{ sample.summary }}
                </p>
                <p class="truncate text-sm leading-[1.4286] font-medium text-muted-foreground">
                  {{ sample.stats }}
                </p>
              </div>
            </div>

            <div class="flex shrink-0 items-center gap-2">
              <span
                class="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-[11px] leading-none text-muted-foreground"
              >
                已完成
              </span>
              <ChevronRight class="size-3.5 text-muted-foreground" />
            </div>
          </div>
        </div>
      </ToolSampleCard>
    </div>
  </ToolGallerySection>
</template>
