<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter } from "@willow/shadcn/components/ui/sidebar";
import { Settings } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import NavMain from "./NavMain.vue";

const route = useRoute();
const router = useRouter();

function openSettings() {
  router.push({
    path: "/setting",
    query: route.path.startsWith("/setting") ? undefined : { from: route.fullPath },
  });
}
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
    <SidebarFooter>
      <Button variant="ghost" size="sm" class="justify-start" @click="openSettings">
        <Settings class="size-4" aria-hidden="true" />
        设置
      </Button>
    </SidebarFooter>
  </Sidebar>
</template>
