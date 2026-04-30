<script setup lang="ts">
import { ToolCallCard } from "@willow/ui";
import { LoaderCircle } from "lucide-vue-next";
import ToolGallerySection from "../components/ToolGallerySection.vue";
import ToolSampleCard from "../components/ToolSampleCard.vue";
</script>

<template>
  <ToolGallerySection
    title="Loading"
    description="运行中工具卡片，检查 loading 入参启动的扫光反馈。"
  >
    <ToolSampleCard title="Running Tool Call" description="使用真实 ToolCallCard loading prop。">
      <ToolCallCard title="运行 pnpm lint" state-label="运行中" loading>
        <template #icon>
          <LoaderCircle class="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        </template>

        <template #summary>
          <p class="truncate text-sm text-muted-foreground">正在检查工具调用卡片的运行中反馈</p>
        </template>
      </ToolCallCard>
    </ToolSampleCard>
  </ToolGallerySection>
</template>
