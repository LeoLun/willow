<script setup lang="ts">
import { Settings, PanelLeftClose, PanelLeftOpen } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

defineProps<{
  isLeftCollapsed: boolean;
}>();

const emit = defineEmits<{
  (e: "toggle-sidebar"): void;
  (e: "open-settings"): void;
}>();
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <header
      class="flex h-[40px] shrink-0 items-center drag-region border-b border-border bg-background"
    >
      <!-- Left: macOS traffic lights 预留空间 + 侧边栏折叠按钮 -->
      <div class="flex items-center pl-[70px]">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="no-drag-region text-muted-foreground hover:text-foreground"
              :aria-label="isLeftCollapsed ? '展开侧边栏' : '收起侧边栏'"
              @click="emit('toggle-sidebar')"
            >
              <PanelLeftOpen
                v-if="isLeftCollapsed"
                class="size-4"
                aria-hidden="true"
              />
              <PanelLeftClose v-else class="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" :side-offset="4">
            {{ isLeftCollapsed ? "展开侧边栏" : "收起侧边栏" }}
          </TooltipContent>
        </Tooltip>
      </div>

      <!-- 中间: 对话标题 (可拖拽区域) -->
      <div class="flex flex-1 items-center justify-center">
        <span class="text-xs text-muted-foreground select-none">对话标题</span>
      </div>

      <!-- Right: 设置按钮 -->
      <div class="flex items-center pr-3">
        <Tooltip>
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="no-drag-region text-muted-foreground hover:text-foreground"
              aria-label="设置"
              @click="emit('open-settings')"
            >
              <Settings class="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" :side-offset="4">
            设置
          </TooltipContent>
        </Tooltip>
      </div>
    </header>
  </TooltipProvider>
</template>
