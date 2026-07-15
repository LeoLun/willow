<script setup lang="ts">
import { SidebarInset, SidebarProvider } from "@willow/shadcn/components/ui/sidebar";
import AppSidebar from "@/components/layout/AppSidebar.vue";
import TopBar from "@/components/layout/TopBar.vue";
</script>

<template>
  <SidebarProvider :default-open="true" class="min-h-screen" style="--sidebar-width: 256px">
    <AppSidebar />
    <SidebarInset class="min-w-0 overflow-hidden">
      <TopBar />
      <div class="min-h-0 flex-1 overflow-auto">
        <RouterView />
      </div>
    </SidebarInset>
  </SidebarProvider>
</template>
