<script setup lang="ts">
import { FileText, Wrench } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";
import ToolStateRows from "../components/ToolStateRows.vue";

const fallbackDetails = [
  { icon: Wrench, text: "未识别工具" },
  { icon: FileText, text: "默认降级渲染" },
] as const;
</script>

<template>
  <ToolGallerySection
    title="Default Fallback"
    description="回退渲染路径，适合检查未知工具的降级表现。"
  >
    <ToolSampleCard title="Default Fallback" description="检查没有专用 renderer 时的默认降级表现。">
      <ToolStateRows action="渲染未知工具" :details="fallbackDetails" />
    </ToolSampleCard>
  </ToolGallerySection>
</template>
