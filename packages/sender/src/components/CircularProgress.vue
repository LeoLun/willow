<template>
  <div
    class="relative flex items-center justify-center"
    :style="{ width: `${size}px`, height: `${size}px` }"
  >
    <svg :width="size" :height="size" class="-rotate-90 transform">
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="transparent"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        class="text-neutral-300"
      />
      <circle
        :cx="size / 2"
        :cy="size / 2"
        :r="radius"
        fill="transparent"
        stroke="currentColor"
        :stroke-width="strokeWidth"
        stroke-linecap="round"
        class="text-primary transition-all duration-500 ease-out"
        :style="{
          strokeDasharray: circumference,
          strokeDashoffset: dashoffset,
        }"
      />
    </svg>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    progress?: number;
    size?: number;
  }>(),
  {
    progress: 0,
    size: 100,
  },
);

const strokeWidth = computed(() => props.size * 0.2);
const radius = computed(() => (props.size - strokeWidth.value) / 2);
const circumference = computed(() => 2 * Math.PI * radius.value);
const dashoffset = computed(() => {
  return circumference.value - (props.progress / 100) * circumference.value;
});
</script>
