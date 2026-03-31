<template>
  <div
    class="relative flex items-center justify-center"
    :style="{ width: size + 'px', height: size + 'px' }"
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

<script setup>
import { computed } from "vue";

const props = defineProps({
  progress: { type: Number, default: 0 }, // 进度 (0 - 100)
  size: { type: Number, default: 100 }, // 画布大小 (px)
});

const strokeWidth = computed(() => props.size * 0.2);

// 计算半径：需减去描边宽度的一半，防止溢出
const radius = computed(() => (props.size - strokeWidth.value) / 2);

// 计算周长：C = 2 * π * r
const circumference = computed(() => 2 * Math.PI * radius.value);

// 计算偏移量：(1 - 进度百分比) * 周长
const dashoffset = computed(() => {
  return circumference.value - (props.progress / 100) * circumference.value;
});
</script>
