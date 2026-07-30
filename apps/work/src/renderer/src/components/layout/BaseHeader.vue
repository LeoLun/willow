<script setup lang="ts">
import { useSidebar } from "@willow/shadcn/components/ui/sidebar";

defineSlots<{
  left(): unknown;
  right(): unknown;
}>();

const { state } = useSidebar();
</script>

<template>
  <header class="drag-region flex shrink-0 items-center justify-between px-4 pt-[12px]">
    <div class="no-drag-region flex h-8 min-w-0 items-center">
      <div
        class="no-drag-region h-full shrink-0 transition-all duration-200 ease-linear"
        :class="{ 'w-34': state === 'collapsed', 'w-0': state !== 'collapsed' }"
        aria-hidden="true"
      />
      <slot name="left" />
    </div>
    <div class="no-drag-region flex h-8 shrink-0 items-center">
      <slot name="right" />
    </div>
  </header>
</template>
