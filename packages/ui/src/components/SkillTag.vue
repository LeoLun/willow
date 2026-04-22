<script setup lang="ts">
import { BoxesIcon } from "lucide-vue-next";

defineProps<{
  name: string;
}>();
</script>

<template>
  <span
    class="inline-flex h-7 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-emerald-600)_12%,transparent)] px-2.5 align-middle text-sm leading-none text-[var(--color-emerald-600)]"
  >
    <BoxesIcon class="size-3.5 shrink-0" />
    <span class="max-w-[13rem] truncate font-medium">{{ name }}</span>
  </span>
</template>
