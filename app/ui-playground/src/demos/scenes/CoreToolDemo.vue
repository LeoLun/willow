<script setup lang="ts">
import { Braces, Code } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";
import ToolStateRows from "../components/ToolStateRows.vue";

const coreDetails = [
  { icon: Code, text: "renderer: core" },
  { icon: Braces, text: "JSON 参数详情" },
] as const;
</script>

<template>
  <ToolGallerySection
    title="Core Renderer"
    description="通用 core 渲染路径，适合检查展开详情和 JSON 输出。"
  >
    <ToolSampleCard title="Core Renderer" description="检查通用工具头部、展开详情和 JSON 输出。">
      <ToolStateRows action="渲染 Core 工具详情" :details="coreDetails" />
    </ToolSampleCard>
  </ToolGallerySection>
</template>
