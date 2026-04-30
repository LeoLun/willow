<script setup lang="ts">
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import type { Component } from "vue";

defineProps<{
  action: string;
  details: readonly {
    icon: Component;
    text: string;
  }[];
}>();
</script>

<template>
  <div class="space-y-3.5">
    <p class="h-[22px] truncate text-sm leading-[1.4286] font-medium text-muted-foreground/60">
      {{ action }}
    </p>

    <div class="inline-flex h-[22px] max-w-full items-center gap-1.5 text-foreground">
      <span class="truncate text-sm leading-[1.4286] font-medium">{{ action }}</span>
      <ChevronRight class="size-3.5 shrink-0 text-muted-foreground" />
    </div>

    <div class="space-y-[5px]">
      <div class="inline-flex h-[22px] max-w-full items-center gap-1.5 text-muted-foreground/60">
        <span class="truncate text-sm leading-[1.4286] font-medium">{{ action }}</span>
        <ChevronDown class="size-3.5 shrink-0 text-muted-foreground" />
      </div>

      <div class="space-y-[5px] text-muted-foreground">
        <div
          v-for="detail in details"
          :key="detail.text"
          class="flex h-[22px] min-w-0 items-center gap-2"
        >
          <component :is="detail.icon" class="size-3.5 shrink-0" />
          <span class="min-w-0 truncate text-sm leading-[1.4286] font-medium">
            {{ detail.text }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
