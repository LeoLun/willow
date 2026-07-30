<script setup lang="ts">
import { SidebarInset, SidebarProvider } from "@willow/shadcn/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import { useAppUpdateListener } from "@/composables/useAppUpdate";
import { useMessageListener } from "@/composables/useMessage";
import { useToolApprovalListener } from "@/composables/useToolApproval";

useMessageListener();
useToolApprovalListener();
useAppUpdateListener();
</script>

<template>
  <SidebarProvider
    :default-open="true"
    class="h-svh overflow-hidden"
    style="--sidebar-width: 256px"
  >
    <AppSidebar />
    <SidebarInset class="h-full min-h-0 min-w-0 overflow-hidden">
      <div class="min-h-0 flex-1 overflow-hidden">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
