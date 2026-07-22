<script setup lang="ts">
import { FileIcon } from "lucide-vue-next";

defineProps<{
  fileName: string;
  path: string;
}>();
</script>

<template>
  <span class="inline-flex items-center gap-1 text-primary" :title="path">
    <FileIcon class="size-4 shrink-0" />
    <span>{{ fileName }}</span>
  </span>
</template>
