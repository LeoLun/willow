<script setup lang="ts">
import { FileTextIcon } from "lucide-vue-next";

defineProps<{
  name: string;
  path: string;
}>();
</script>

<template>
  <span
    class="inline-flex h-7 items-center gap-1 rounded-full bg-primary/12 px-2.5 align-middle text-sm leading-none text-primary"
    :title="path"
  >
    <FileTextIcon class="size-3.5 shrink-0" />
    <span class="max-w-[13rem] truncate font-medium">{{ name }}</span>
  </span>
</template>
