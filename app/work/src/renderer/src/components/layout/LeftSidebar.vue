<script setup lang="ts">
import { SquarePen } from "lucide-vue-next";
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

const placeholders = ["对话1", "对话2", "对话3", "对话4", "对话5"];
</script>

<template>
  <TooltipProvider :delay-duration="0">
    <aside class="flex h-full flex-col" role="complementary">
      <!-- Header: 新建对话按钮 -->
      <div
        class="flex shrink-0 items-center px-2 py-2"
        :class="isCollapsed ? 'justify-center' : 'justify-between'"
      >
        <!-- 折叠态: 图标按钮 + Tooltip -->
        <Tooltip v-if="isCollapsed">
          <TooltipTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label="新建对话"
              class="text-muted-foreground hover:text-foreground"
            >
              <SquarePen class="size-4" aria-hidden="true" />
            </Button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            :side-offset="4"
            :avoid-collisions="false"
          >
            新建对话
          </TooltipContent>
        </Tooltip>

        <!-- 展开态: 带文字的按钮，无需 Tooltip -->
        <Button
          v-else
          variant="ghost"
          size="sm"
          class="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
          aria-label="新建对话"
        >
          <SquarePen class="size-4" aria-hidden="true" />
          <span class="text-xs">新建对话</span>
        </Button>
      </div>

      <!-- 对话列表 -->
      <nav class="flex-1 overflow-y-auto px-2 py-1" aria-label="对话列表">
        <div class="space-y-0.5">
          <!-- 折叠态: 仅显示图标 + Tooltip -->
          <template v-if="isCollapsed">
            <Tooltip v-for="item in placeholders" :key="item">
              <TooltipTrigger as-child>
                <button
                  class="flex w-full items-center justify-center rounded-md p-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  :aria-label="item"
                >
                  <div class="size-4 shrink-0 rounded bg-muted" />
                </button>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                :side-offset="4"
                :avoid-collisions="false"
              >
                {{ item }}
              </TooltipContent>
            </Tooltip>
          </template>

          <!-- 展开态: 图标 + 文字 -->
          <template v-else>
            <button
              v-for="item in placeholders"
              :key="item"
              class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
              <div class="size-4 shrink-0 rounded bg-muted" />
              <span class="min-w-0 truncate">{{ item }}</span>
            </button>
          </template>
        </div>
      </nav>
    </aside>
  </TooltipProvider>
</template>
