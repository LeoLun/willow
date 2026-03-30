<script setup lang="ts">
import { Loader } from "lucide-vue-next";

defineProps<{
  state: "inprogress" | "complete" | "error";
  text: string;
}>();
</script>

<template>
  <div
    class="flex items-center gap-2 text-sm text-muted-foreground"
    :class="{ 'justify-between': state === 'inprogress' }"
  >
    <div class="flex items-center gap-2">
      <span
        class="inline-block"
        :class="{
          'text-foreground': state === 'inprogress',
          'text-green-600 dark:text-green-500': state === 'complete',
          'text-destructive': state === 'error',
        }"
      >
        <slot name="icon" />
      </span>
      {{ text }}
    </div>
    <Loader v-if="state === 'inprogress'" class="h-4 w-4 animate-spin text-foreground" />
  </div>
</template>
