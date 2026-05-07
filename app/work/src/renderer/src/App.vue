<script setup lang="ts">
import type { Automation, Session } from "@shared/api";
import { SESSION_TITLE_UPDATED } from "@shared/constants";
import { Card } from "@willow/shadcn";
import { SidebarProvider, SidebarTrigger } from "@willow/shadcn/components/ui/sidebar";
import { Toaster } from "@willow/shadcn/components/ui/sonner";
import { TooltipProvider } from "@willow/shadcn/components/ui/tooltip";
import { registryAllToolRenderers } from "@willow/ui";
import { computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import { useDarkMode } from "@/composables/useDarkMode";
import { useEventBus } from "@/composables/useEventBus";
import { DialogProvider } from "@/layout/dialog";
import { router } from "@/router";
import { useSessionStore } from "@/stores/session";
import "vue-sonner/style.css";
import LeftSidebar from "./layout/sidebar/LeftSidebar.vue";

useDarkMode();

registryAllToolRenderers({
  onOpenUrl: (url: string) => {
    window.open(url, "_blank");
  },
  onOpenAutomation: (automation: Automation) => {
    router.push(`/auto/${automation.id}`);
  },
});

const route = useRoute();
const sessionStore = useSessionStore();
const { addEventListener, removeEventListener } = useEventBus();
const isSettingsLayout = computed(() =>
  route.matched.some((record) => record.meta.layout === "settings"),
);

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
  <TooltipProvider :delay-duration="0">
    <div v-if="isSettingsLayout" class="h-screen w-screen overflow-hidden bg-background">
      <RouterView />
    </div>

    <SidebarProvider v-else class="relative flex h-screen w-screen overflow-hidden bg-sidebar">
      <LeftSidebar />
      <SidebarTrigger class="absolute top-[7.5px] left-[70px] z-100" />

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
  </TooltipProvider>
  <DialogProvider />
  <Toaster position="top-center" />
</template>
