<script setup lang="ts">
import { CircleCheck, CircleX, FileText, Terminal } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";
import ToolStateRows from "../components/ToolStateRows.vue";

const bashSamples = [
  {
    title: "成功态",
    description: "检查命令摘要、输出块和完成状态。",
    action: "运行 pnpm lint",
    details: [
      { icon: Terminal, text: "pnpm lint" },
      { icon: CircleCheck, text: "运行完成" },
      { icon: FileText, text: "控制台输出" },
    ],
  },
  {
    title: "失败态",
    description: "检查错误输出、边框和长文本表现。",
    action: "运行 pnpm dev:ui",
    details: [
      { icon: Terminal, text: "pnpm dev:ui" },
      { icon: CircleX, text: "运行失败" },
      { icon: FileText, text: "错误输出" },
    ],
  },
] as const;
</script>

<template>
  <ToolGallerySection title="Bash" description="命令执行类工具，适合检查成功态、失败态和输出块。">
    <div class="grid gap-5">
      <ToolSampleCard
        v-for="sample in bashSamples"
        :key="sample.title"
        :title="sample.title"
        :description="sample.description"
      >
        <ToolStateRows :action="sample.action" :details="sample.details" />
      </ToolSampleCard>
    </div>
  </ToolGallerySection>
</template>
