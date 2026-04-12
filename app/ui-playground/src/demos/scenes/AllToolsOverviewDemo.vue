<script setup lang="ts">
import AutomationToolDemo from "./AutomationToolDemo.vue";
import BashToolDemo from "./BashToolDemo.vue";
import CoreToolDemo from "./CoreToolDemo.vue";
import DefaultToolDemo from "./DefaultToolDemo.vue";
import TodoToolDemo from "./TodoToolDemo.vue";
import WebFetchToolDemo from "./WebFetchToolDemo.vue";
import WebSearchToolDemo from "./WebSearchToolDemo.vue";

const sections = [
  {
    id: "bash",
    title: "Bash",
    description: "命令执行类工具，适合检查成功态、失败态和输出块。",
    component: BashToolDemo,
  },
  {
    id: "web-search",
    title: "Web Search",
    description: "搜索类工具，适合检查站点摘要、链接 pill 和结果详情。",
    component: WebSearchToolDemo,
  },
  {
    id: "web-fetch",
    title: "Web Fetch",
    description: "抓取类工具，适合检查 URL 摘要、内容预览和参数面板。",
    component: WebFetchToolDemo,
  },
  {
    id: "todo",
    title: "Todo",
    description: "任务列表类工具，适合检查计数、状态图标和展开明细。",
    component: TodoToolDemo,
  },
  {
    id: "automation",
    title: "Automation Create",
    description: "自动化创建结果，适合检查计划表达和结果卡片层级。",
    component: AutomationToolDemo,
  },
  {
    id: "core",
    title: "Core Renderer",
    description: "通用 core 渲染路径，适合检查展开详情和 JSON 输出。",
    component: CoreToolDemo,
  },
  {
    id: "default",
    title: "Default Fallback",
    description: "回退渲染路径，适合检查未知工具的降级表现。",
    component: DefaultToolDemo,
  },
] as const;
</script>

<template>
  <div class="space-y-6">
    <div class="rounded-2xl border border-border bg-muted/30 px-5 py-4">
      <h3 class="text-sm font-semibold text-foreground">全部工具总览</h3>
      <p class="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">
        这个页面把当前 playground 里的所有工具调用 demo 聚合到一起，适合一次性扫视觉层级、
        卡片密度、状态文案和展开区的一致性。
      </p>
    </div>

    <section
      v-for="section in sections"
      :key="section.id"
      class="space-y-3 rounded-3xl border border-border bg-background/70 px-4 py-4 shadow-sm lg:px-5"
    >
      <div class="border-b border-border pb-3">
        <h3 class="text-base font-semibold text-foreground">{{ section.title }}</h3>
        <p class="mt-1 text-sm leading-6 text-muted-foreground">{{ section.description }}</p>
      </div>

      <component :is="section.component" />
    </section>
  </div>
</template>
