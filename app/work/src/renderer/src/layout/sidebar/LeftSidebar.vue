<script setup lang="ts">
import { Settings } from "lucide-vue-next";
import { useRouter } from "vue-router";
import { Button } from "@/components/ui/button";
import { Sidebar, SidebarContent, SidebarFooter } from "@/components/ui/sidebar";
import NavMain from "./NavMain.vue";

const router = useRouter();
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
      <Button variant="ghost" size="sm" class="justify-start" @click="router.push('/setting')">
        <Settings class="size-4" aria-hidden="true" />
        设置
      </Button>
    </SidebarFooter>
  </Sidebar>
</template>
