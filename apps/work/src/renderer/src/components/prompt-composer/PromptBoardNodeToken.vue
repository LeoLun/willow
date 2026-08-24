<script setup lang="ts">
import { Kanban } from "lucide-vue-next";

defineProps<{
  label: string;
  path: string;
  selector: string;
  tag: string;
  summary: string;
}>();
</script>

<template>
  <span
    class="inline-flex max-w-44 items-center gap-1 rounded-md bg-violet-500/10 px-1.5 py-0.5 text-sm leading-5 whitespace-nowrap text-violet-600 dark:text-violet-400"
    :title="`${path} · ${selector}\n${summary}`"
  >
    <Kanban class="size-4 shrink-0" aria-hidden="true" />
    <span class="min-w-0 truncate">{{ label || tag }}</span>
  </span>
</template>
