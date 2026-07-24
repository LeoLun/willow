<script setup lang="ts">
defineSlots<{
  left(): unknown;
  right(): unknown;
}>();
</script>

<template>
  <header class="drag-region flex shrink-0 items-center justify-between px-4 pt-[12px]">
    <div class="no-drag-region flex h-8 min-w-0 items-center">
      <slot name="left" />
    </div>
    <div class="no-drag-region flex h-8 shrink-0 items-center">
      <slot name="right" />
    </div>
  </header>
</template>
