<script setup lang="ts">
import {
  SquarePen,
  Settings,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

defineProps<{
  isCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-sidebar"): void;
  (e: "open-settings"): void;
}>();

const placeholders = ["对话1", "对话2", "对话3", "对话4", "对话5"];
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <aside class="flex h-full flex-col" role="complementary">
      <!-- macOS traffic lights 预留空间 -->
      <div class="drag-region h-[40px]" />

      <!-- 新建对话按钮 -->
      <div class="flex shrink-0 items-center px-2 py-1 justify-center">
        <!-- 折叠态: 图标按钮 + Tooltip -->
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="default"
              size="icon-sm"
              aria-label="新建对话"
              class="justify-center gap-2 transition-[width] duration-200 ease-in-out"
              :style="{ width: isCollapsed ? '32px' : '100%' }">
              <SquarePen
                class="size-4 transition-[margin-left] duration-200 ease-in-out"
                :style="{ marginLeft: isCollapsed ? '8px' : '0px' }"
              aria-hidden="true" />
              <span class="text-xs overflow-hidden">新建对话</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right" :side-offset="4" :avoid-collisions="false">
            新建对话
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- 对话列表 -->
      <nav class="flex-1 overflow-y-auto px-2 py-1" aria-label="对话列表" :class="isCollapsed ? 'justify-center' : 'justify-between'">
        <div class="space-y-0.5">
          <!-- 展开态: 图标 + 文字 -->
          <template v-if="!isCollapsed">
            <button v-for="item in placeholders" :key="item"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
              <span class="min-w-0 truncate">{{ item }}</span>
            </button>
          </template>
        </div>
      </nav>

      <!-- 底部区域 -->
      <div class="shrink-0">
        <div class="flex items-center px-2 py-2" :class="isCollapsed ? 'justify-center' : 'justify-between'">
          <!-- 设置按钮 -->
          <Button variant="ghost" size="icon-sm" class="text-muted-foreground hover:text-foreground" aria-label="设置"
            @click="emit('open-settings')">
            <Settings class="size-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </aside>
  </TooltipProvider>
</template>
