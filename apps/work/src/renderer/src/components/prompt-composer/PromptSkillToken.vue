<script setup lang="ts">
import { BadgeCheckIcon } from "lucide-vue-next";

defineProps<{
  path: string;
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1 text-primary" :title="path">
    <BadgeCheckIcon class="size-4 shrink-0" />
    <span>skill</span>
  </span>
</template>
