<script setup lang="ts">
import { BoxesIcon } from "lucide-vue-next";

defineProps<{
  name: string;
}>();
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 align-baseline text-sm leading-normal text-primary"
  >
    <BoxesIcon class="size-3.5 shrink-0" />
    <span class="max-w-[13rem] truncate font-medium">{{ name }}</span>
  </span>
</template>
