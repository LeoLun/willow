<script setup lang="ts">
import { FileText, List, Search } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";
import ToolStateRows from "../components/ToolStateRows.vue";

const webSearchDetails = [
  { icon: Search, text: "Willow tool renderer" },
  { icon: List, text: "2 条搜索结果" },
  { icon: FileText, text: "结果摘要" },
] as const;
</script>

<template>
  <ToolGallerySection
    title="Web Search"
    description="搜索类工具，适合检查站点摘要、链接 pill 和结果详情。"
  >
    <ToolSampleCard title="Web Search 工具状态" description="检查站点摘要、链接 pill 和结果详情。">
      <ToolStateRows action="搜索 Willow tool renderer" :details="webSearchDetails" />
    </ToolSampleCard>
  </ToolGallerySection>
</template>
