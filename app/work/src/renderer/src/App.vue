<template>
  <TopDragBar />
  <div class="flex h-screen w-screen overflow-hidden bg-sidebar">
    <!-- 左侧边栏 (可折叠) -->
    <div
      class="shrink-0 transition-[width] duration-200 ease-in-out"
      :style="{ width: isLeftCollapsed ? '70px' : '220px' }"
    >
      <LeftSidebar
        :is-collapsed="isLeftCollapsed"
        @toggle-sidebar="toggleLeftSidebar"
      />
    </div>

    <!-- 主区域 -->
    <div class="flex min-w-0 flex-1 flex-col p-4 pl-0">
      <Card class="relative !flex-row flex-1 gap-0 overflow-hidden !py-0">
        <!-- 左上角折叠按钮 -->
        <Button
          variant="ghost"
          size="icon-sm"
          class="absolute left-2 top-2 z-10 text-muted-foreground hover:text-foreground"
          :aria-label="isLeftCollapsed ? '展开侧边栏' : '收起侧边栏'"
          @click="toggleLeftSidebar"
        >
          <PanelLeftOpen
            v-if="isLeftCollapsed"
            class="size-4"
            aria-hidden="true"
          />
          <PanelLeftClose v-else class="size-4" aria-hidden="true" />
        </Button>

        <!-- 中间内容区域 -->
        <div class="min-w-0 flex-1 h-full overflow-hidden">
          <MainContent />
        </div>
      </Card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { PanelLeftClose, PanelLeftOpen } from "lucide-vue-next";
import LeftSidebar from "@/components/layout/LeftSidebar.vue";
import MainContent from "@/components/layout/MainContent.vue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/composables/useDarkMode";
import TopDragBar from "@/components/base/TopDragBar.vue";

useDarkMode();

const isLeftCollapsed = ref(false);

function toggleLeftSidebar() {
  isLeftCollapsed.value = !isLeftCollapsed.value;
}
</script>

<style scoped></style>
