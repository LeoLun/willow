<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/styles";

export interface LoadingProps {
  class?: HTMLAttributes["class"];
}

const props = defineProps<LoadingProps>();

const dots = Array.from({ length: 9 }, (_, index) => ({
  index,
  animationDelay: `${((index % 3) + Math.floor(index / 3)) * 200}ms`,
}));
</script>

<template>
  <div
    :class="cn('loading-grid grid size-10.5 grid-cols-3 grid-rows-3', props.class)"
    role="status"
    aria-label="正在加载"
    data-slot="loading"
  >
    <div
      v-for="dot in dots"
      :key="dot.index"
      class="loading-dot size-full rounded-full bg-foreground"
      :style="{ animationDelay: dot.animationDelay }"
      aria-hidden="true"
      data-slot="loading-dot"
    />
  </div>
</template>

<style scoped>
.loading-grid {
  gap: calc(100% / 7);
}

.loading-dot {
  animation: loading-dot-pulse 1.5s ease-in-out infinite;
}

@keyframes loading-dot-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(0.5);
    opacity: 0.3;
  }
}

@media (prefers-reduced-motion: reduce) {
  .loading-dot {
    animation: none;
  }
}
</style>
