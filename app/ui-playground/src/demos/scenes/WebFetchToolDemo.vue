<script setup lang="ts">
import { CircleCheck, FileText, Globe } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolStateRows from "../components/ToolStateRows.vue";

const webFetchDetails = [
  { icon: Globe, text: "vite.dev/config/server-options" },
  { icon: CircleCheck, text: "抓取完成" },
  { icon: FileText, text: "Markdown 内容预览" },
] as const;
</script>

<template>
  <ToolGallerySection
    title="Web Fetch"
    description="抓取类工具，适合检查 URL 摘要、内容预览和参数面板。"
  >
    <div
      class="rounded-[16px] border border-border bg-card p-[18px] shadow-[0_2px_6px_rgba(0,0,0,0.08)]"
    >
      <h3 class="text-lg leading-none font-bold tracking-normal text-foreground">
        Web Fetch 工具状态
      </h3>
      <p class="mt-2.5 text-[15px] leading-5 font-semibold tracking-normal text-muted-foreground">
        按 Web Fetch 的实际信息展示普通、hover 与展开态。
      </p>

      <div class="mt-3.5">
        <ToolStateRows action="读取 vite.dev/config/server-options" :details="webFetchDetails" />
      </div>
    </div>
  </ToolGallerySection>
</template>
