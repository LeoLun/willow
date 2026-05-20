<script setup lang="ts">
import { BotIcon } from "lucide-vue-next";

defineProps<{
  agentName: string;
  workspaceId?: number;
}>();
</script>

<template>
  <span
    class="inline-flex h-7 items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--color-sky-600)_12%,transparent)] px-2.5 align-middle text-sm leading-none text-[var(--color-sky-700)]"
  >
    <BotIcon class="size-3.5 shrink-0" />
    <span class="max-w-[13rem] truncate font-medium">{{ agentName }}</span>
  </span>
</template>
