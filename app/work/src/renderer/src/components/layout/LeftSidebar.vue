<script setup lang="ts">
import { Settings } from "lucide-vue-next";
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

defineEmits<{
  (e: "toggle-sidebar"): void;
}>();
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <aside class="flex h-full flex-col" role="complementary">
      <!-- macOS traffic lights 预留空间 -->
      <div class="drag-region h-[40px]" />

      <!-- 导航区域 -->
      <nav
        class="flex-1 overflow-y-auto px-2 py-1"
        :class="isCollapsed ? 'justify-center' : 'justify-between'"
      >
      </nav>

      <!-- 底部区域 -->
      <div class="shrink-0">
        <div class="flex items-center px-2 py-2" :class="isCollapsed ? 'justify-center' : 'justify-between'">
          <Tooltip>
            <TooltipTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                class="text-muted-foreground hover:text-foreground"
                aria-label="设置"
              >
                <Settings class="size-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right" :side-offset="4">
              设置
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </aside>
  </TooltipProvider>
</template>
