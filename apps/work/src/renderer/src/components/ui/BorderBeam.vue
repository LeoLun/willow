<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, shallowRef } from "vue";
import type { StyleValue } from "vue";

interface Props {
  size?: number;
  pathRadius?: number;
  duration?: number;
  delay?: number;
  colorFrom?: string;
  colorTo?: string;
  borderWidth?: number;
  reverse?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  size: 50,
  pathRadius: undefined,
  duration: 6,
  delay: 0,
  colorFrom: "#ffaa40",
  colorTo: "#9c40ff",
  borderWidth: 1,
  reverse: false,
});

const LAYER_COUNT = 12;
const PATH_INSET = 0.5;
const container = shallowRef<HTMLElement>();
const dimensions = shallowRef({ width: 0, height: 0 });
let resizeObserver: ResizeObserver | undefined;

const beamStyle = computed<StyleValue>(() => ({
  "--border-beam-size": `${props.size}px`,
  "--border-beam-path-radius": `${props.pathRadius ?? props.size}px`,
  "--border-beam-path-inset": `${PATH_INSET}px`,
  "--border-beam-duration": `${props.duration}s`,
  "--border-beam-delay": `${-props.delay}s`,
  "--border-beam-color-from": props.colorFrom,
  "--border-beam-color-to": props.colorTo,
  "--border-beam-width": `${props.borderWidth}px`,
}));

const geometry = computed(() => {
  const width = Math.max(dimensions.value.width - PATH_INSET * 2, 0);
  const height = Math.max(dimensions.value.height - PATH_INSET * 2, 0);
  const outerRadius = props.pathRadius ?? props.size;
  const radius = Math.min(Math.max(outerRadius - PATH_INSET, 0), width / 2, height / 2);
  const perimeter = 2 * (width + height - 4 * radius) + 2 * Math.PI * radius;
  return { inset: PATH_INSET, width, height, radius, perimeter };
});

const beamLayers = computed(() => {
  const pathLength = geometry.value.perimeter;
  if (pathLength <= 0) return [];

  const beamLength = Math.min(props.size, pathLength * 0.45);
  return Array.from({ length: LAYER_COUNT }, (_, index) => {
    const progress = index / (LAYER_COUNT - 1);
    const layerLength = beamLength * (0.35 + progress * 0.65);
    const opacity = (1 - progress) ** 1.7 * 0.34;
    return {
      index,
      style: {
        opacity,
        strokeDasharray: `${layerLength} ${pathLength - layerLength}`,
        "--border-beam-path-length": `${pathLength}px`,
        "--border-beam-segment-offset": `${layerLength / 2}px`,
      } as StyleValue,
    };
  });
});

function updateDimensions(): void {
  const root = container.value;
  if (!root) return;
  dimensions.value = { width: root.clientWidth, height: root.clientHeight };
}

onMounted(() => {
  updateDimensions();
  if (typeof ResizeObserver === "undefined" || !container.value) return;
  resizeObserver = new ResizeObserver(updateDimensions);
  resizeObserver.observe(container.value);
});

onBeforeUnmount(() => resizeObserver?.disconnect());
</script>

<template>
  <div
    ref="container"
    aria-hidden="true"
    class="border-beam"
    :class="{ 'border-beam--reverse': props.reverse }"
    :style="beamStyle"
  >
    <svg class="border-beam__svg">
      <rect
        v-for="layer in beamLayers"
        :key="layer.index"
        class="border-beam__segment"
        :style="layer.style"
        :x="geometry.inset"
        :y="geometry.inset"
        :width="geometry.width"
        :height="geometry.height"
        :rx="geometry.radius"
        :ry="geometry.radius"
        fill="none"
      />
    </svg>
  </div>
</template>

<style scoped>
.border-beam {
  pointer-events: none;
  position: absolute;
  top: -1px;
  right: -1px;
  bottom: -1px;
  left: -1px;
  border-radius: inherit;
  overflow: hidden;
}

.border-beam__svg {
  position: absolute;
  inset: 0;
  width: calc(100% + 2px);
  height: calc(100% + 2px);
  overflow: visible;
}

.border-beam__segment {
  stroke: var(--border-beam-color-to);
  stroke-width: var(--border-beam-width);
  stroke-linecap: round;
  vector-effect: non-scaling-stroke;
  animation: border-beam var(--border-beam-duration) linear var(--border-beam-delay) infinite;
}

.border-beam--reverse .border-beam__segment {
  animation-direction: reverse;
}

@keyframes border-beam {
  from {
    stroke-dashoffset: var(--border-beam-segment-offset);
  }
  to {
    stroke-dashoffset: calc(var(--border-beam-segment-offset) - var(--border-beam-path-length));
  }
}

@media (prefers-reduced-motion: reduce) {
  .border-beam__segment {
    animation: none;
    stroke-dashoffset: var(--border-beam-segment-offset);
  }
}
</style>
