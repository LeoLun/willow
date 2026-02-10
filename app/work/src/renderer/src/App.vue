<template>
  <div class="flex h-screen w-screen flex-col overflow-hidden">
    <!-- 顶栏操作栏 -->
    <TopBar
      :is-left-collapsed="isLeftCollapsed"
      @toggle-sidebar="toggleLeftSidebar"
      @open-settings="showSettings = true"
    />

    <!-- 主区域: 左侧栏 + 中间区域 + 右侧栏 -->
    <ResizablePanelGroup direction="horizontal" class="flex-1">
      <!-- 左侧边栏 (可折叠) -->
      <ResizablePanel
        ref="leftPanelRef"
        :default-size="18"
        :min-size="12"
        :max-size="30"
        collapsible
        :collapsed-size="4"
        class="bg-sidebar"
        @collapse="isLeftCollapsed = true"
        @expand="isLeftCollapsed = false"
      >
        <LeftSidebar :is-collapsed="isLeftCollapsed" />
      </ResizablePanel>

      <ResizableHandle />

      <!-- 中间区域 -->
      <ResizablePanel :default-size="64" :min-size="30">
        <MainContent />
      </ResizablePanel>

      <ResizableHandle />

      <!-- 右侧边栏 -->
      <ResizablePanel
        :default-size="18"
        :min-size="12"
        :max-size="30"
        class="bg-sidebar"
      >
        <RightSidebar />
      </ResizablePanel>
    </ResizablePanelGroup>

    <!-- 底部信息栏 -->
    <BottomBar />
  </div>

  <!-- 设置弹窗 -->
  <SettingsDialog v-model:open="showSettings" />
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import TopBar from "@/components/layout/TopBar.vue";
import LeftSidebar from "@/components/layout/LeftSidebar.vue";
import RightSidebar from "@/components/layout/RightSidebar.vue";
import MainContent from "@/components/layout/MainContent.vue";
import BottomBar from "@/components/layout/BottomBar.vue";
import SettingsDialog from "@/components/settings/SettingsDialog.vue";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { useDarkMode } from "@/composables/useDarkMode";
import { electronAPI } from "./lib/ipc";

useDarkMode();

const leftPanelRef = ref<InstanceType<typeof ResizablePanel>>();
const isLeftCollapsed = ref(false);
const showSettings = ref(false);

function toggleLeftSidebar() {
  const panel = leftPanelRef.value as
    | (InstanceType<typeof ResizablePanel> & {
        collapse: () => void;
        expand: () => void;
      })
    | undefined;
  if (!panel) return;
  if (isLeftCollapsed.value) {
    panel.expand();
  } else {
    panel.collapse();
  }
}

onMounted(async () => {
  const { message } = await electronAPI.echo("hello");
  console.log(message);

  const { url } = await electronAPI.startOpencode();
  console.log(url);
});
</script>

<style scoped></style>
