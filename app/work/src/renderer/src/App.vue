
<script setup lang="ts">
import LeftSidebar from "./layout/sidebar/LeftSidebar.vue";
import { Card } from "@/components/ui/card";
import { useDarkMode } from "@/composables/useDarkMode";
import TopDragBar from "@/components/base/TopDragBar.vue";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { DialogProvider } from "@/layout/dialog";
useDarkMode();

</script>
<template>
  <TopDragBar />
  <SidebarProvider class="relative flex h-screen w-screen overflow-hidden bg-sidebar">
    <LeftSidebar />
    <SidebarTrigger class="absolute left-[70px] top-[5px] z-100"/>

    <!-- 主区域 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <Card class="relative !flex-row flex-1 gap-0 overflow-hidden !py-0">
        <!-- 中间内容区域 -->
        <div class="min-w-0 flex-1 h-full overflow-hidden">
          <RouterView />
        </div>
      </Card>
    </div>
  </SidebarProvider>
  <DialogProvider />
</template>
