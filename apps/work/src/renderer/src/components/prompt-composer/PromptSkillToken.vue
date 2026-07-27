<script setup lang="ts">
import { BoxIcon } from "lucide-vue-next";

defineProps<{
  skillName: string;
  path: string;
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1 text-blue-500" :title="path">
    <BoxIcon class="size-4 shrink-0" />
    <span>{{ skillName }}</span>
  </span>
</template>
