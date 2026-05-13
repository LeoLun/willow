<script setup lang="ts">
import { useSidebar } from "@willow/shadcn/components/ui/sidebar";
import { computed } from "vue";
const { state } = useSidebar();

const isCollapsed = computed(() => {
  return state.value === "collapsed";
});
</script>
<template>
  <div
    class="flex w-full flex-col items-center transition-all duration-300"
    :class="{ 'pl-[85px]': isCollapsed }"
  >
    <div class="drag-region h-2 w-full"></div>
    <div class="flex h-9 w-full items-center gap-1 px-2 pb-2">
      <slot />
      <div class="drag-region h-full flex-1"></div>
      <slot name="extra" />
    </div>
  </div>
</template>
