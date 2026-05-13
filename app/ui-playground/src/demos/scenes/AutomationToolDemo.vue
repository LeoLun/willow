<script setup lang="ts">
import { CalendarClock, CheckCircle2, Clock3 } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";
import ToolStateRows from "../components/ToolStateRows.vue";

const automationDetails = [
  { icon: Clock3, text: "每日 AI 新闻咨询" },
  { icon: CalendarClock, text: "每天 18:00" },
  { icon: CheckCircle2, text: "自动化已创建" },
] as const;
</script>

<template>
  <ToolGallerySection
    title="Automation Create"
    description="自动化创建结果，适合检查计划表达和结果卡片层级。"
  >
    <ToolSampleCard title="自动化创建" description="检查创建任务后的标题、计划表达和结果状态。">
      <ToolStateRows action="创建「每日 AI 新闻咨询」任务" :details="automationDetails" />
    </ToolSampleCard>
  </ToolGallerySection>
</template>
