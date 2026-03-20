<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import NavMain from "./NavMain.vue";
import { Sidebar, SidebarContent } from "@/components/ui/sidebar";

</script>

<template>
  <Sidebar class="flex h-full flex-col border-none">
    <!-- macOS traffic lights 预留空间 -->
    <div class="h-[40px]" />

    <!-- 导航区域 -->
    <SidebarContent class="flex-1 overflow-y-auto px-2 py-1">
      <NavMain :items="[]" />
    </SidebarContent>

    <!-- 底部区域 -->
    <div class="shrink-0">
      <div class="flex items-center px-2 py-2 justify-between">
        <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground" aria-label="设置">
          <Settings class="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  </Sidebar>
</template>
