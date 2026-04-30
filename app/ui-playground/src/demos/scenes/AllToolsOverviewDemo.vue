<script setup lang="ts">
import AutomationToolDemo from "./AutomationToolDemo.vue";
import BashToolDemo from "./BashToolDemo.vue";
import CoreToolDemo from "./CoreToolDemo.vue";
import DefaultToolDemo from "./DefaultToolDemo.vue";
import LoadingToolDemo from "./LoadingToolDemo.vue";
import TodoToolDemo from "./TodoToolDemo.vue";
import WebFetchToolDemo from "./WebFetchToolDemo.vue";
import WebSearchToolDemo from "./WebSearchToolDemo.vue";

const sections = [
  {
    id: "bash",
    component: BashToolDemo,
  },
  {
    id: "loading",
    component: LoadingToolDemo,
  },
  {
    id: "web-search",
    component: WebSearchToolDemo,
  },
  {
    id: "web-fetch",
    component: WebFetchToolDemo,
  },
  {
    id: "todo",
    component: TodoToolDemo,
  },
  {
    id: "automation",
    component: AutomationToolDemo,
  },
  {
    id: "core",
    component: CoreToolDemo,
  },
  {
    id: "default",
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

    <component :is="section.component" v-for="section in sections" :key="section.id" />
  </div>
</template>
