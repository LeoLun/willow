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
        @open-settings="showSettings = true"
      />
    </div>

    <!-- 主区域: Card 包裹中间区域 + 右侧栏 -->
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
                <PanelLeftOpen v-if="isLeftCollapsed" class="size-4" aria-hidden="true" />
                <PanelLeftClose v-else class="size-4" aria-hidden="true" />
              </Button>

        <!-- 中间内容区域 -->
        <div class="min-w-0 flex-1">
          <MainContent />
        </div>

        <!-- 右侧边栏 -->
        <div class="w-[260px] shrink-0">
          <RightSidebar />
        </div>
      </Card>
    </div>
  </div>

  <!-- 设置弹窗 -->
  <SettingsDialog v-model:open="showSettings" />
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { PanelLeftClose, PanelLeftOpen } from "lucide-vue-next";
import LeftSidebar from "@/components/layout/LeftSidebar.vue";
import RightSidebar from "@/components/layout/RightSidebar.vue";
import MainContent from "@/components/layout/MainContent.vue";
import SettingsDialog from "@/components/settings/SettingsDialog.vue";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useDarkMode } from "@/composables/useDarkMode";
import { electronAPI } from "./lib/ipc";
import TopDragBar from "@/components/base/TopDragBar.vue";

useDarkMode();

const isLeftCollapsed = ref(false);
const showSettings = ref(false);

function toggleLeftSidebar() {
  isLeftCollapsed.value = !isLeftCollapsed.value;
}

onMounted(async () => {
  const { message } = await electronAPI.echo("hello");
  console.log(message);

  const { url } = await electronAPI.startOpencode();
  console.log(url);
});
</script>

<style scoped></style>
