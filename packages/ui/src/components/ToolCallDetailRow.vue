<script setup lang="ts">
import type { Component } from "vue";

defineProps<{
  icon?: Component;
  text: string;
}>();
</script>

<template>
  <div
    class="flex min-h-[22px] min-w-0 items-center gap-2 text-sm leading-5 font-medium text-muted-foreground"
  >
    <component :is="icon" v-if="icon" class="size-3.5 shrink-0" />
    <span class="min-w-0 truncate">{{ text }}</span>
  </div>
</template>
