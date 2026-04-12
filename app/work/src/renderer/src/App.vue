<script setup lang="ts">
import type { Session } from "@shared/api";
import { SESSION_TITLE_UPDATED } from "@shared/constants";
import {
  AutomationCreateRendererFactory,
  registerToolRenderer,
  TodoRendererFactory,
} from "@willow/ui";
import { onMounted, onUnmounted } from "vue";
import TopDragBar from "@/components/base/TopDragBar.vue";
import { Card } from "@/components/ui/card";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Toaster } from "@/components/ui/sonner";
import { useDarkMode } from "@/composables/useDarkMode";
import { useEventBus } from "@/composables/useEventBus";
import { DialogProvider } from "@/layout/dialog";
import { router } from "@/router";
import { useSessionStore } from "@/stores/session";
import "vue-sonner/style.css";
import LeftSidebar from "./layout/sidebar/LeftSidebar.vue";

useDarkMode();
// registerToolRenderer(
//   "automation_create",
//   new AutomationCreateRendererFactory({
//     onOpen: () => router.push("/auto"),
//   }),
// );
registerToolRenderer("todoread", new TodoRendererFactory());
registerToolRenderer("todowrite", new TodoRendererFactory());

const sessionStore = useSessionStore();
const { addEventListener, removeEventListener } = useEventBus();

function onSessionTitleUpdated(data: { session: Session }) {
  if (data?.session) {
    sessionStore.applySessionTitleFromMain(data.session);
  }
}

onMounted(() => {
  addEventListener(SESSION_TITLE_UPDATED, onSessionTitleUpdated);
});

onUnmounted(() => {
  removeEventListener(SESSION_TITLE_UPDATED, onSessionTitleUpdated);
});
</script>
<template>
  <SidebarProvider class="relative flex h-screen w-screen overflow-hidden bg-sidebar">
    <LeftSidebar />
    <SidebarTrigger class="absolute top-[9px] left-[70px] z-100" />

    <!-- 主区域 -->
    <div class="flex min-w-0 flex-1 flex-col">
      <Card class="relative flex-1 !flex-row gap-0 overflow-hidden !py-0">
        <!-- 中间内容区域 -->
        <div class="h-full min-w-0 flex-1 overflow-hidden">
          <RouterView />
        </div>
      </Card>
    </div>
  </SidebarProvider>
  <DialogProvider />
  <Toaster position="top-center" />
</template>
