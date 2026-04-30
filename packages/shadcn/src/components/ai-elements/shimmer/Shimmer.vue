<script setup lang="ts">
import type { CSSProperties, HTMLAttributes } from "vue";
import { computed, useSlots } from "vue";
import { cn } from "../../../lib/utils";

export interface ShimmerProps {
  as?: keyof HTMLElementTagNameMap;
  class?: HTMLAttributes["class"];
  duration?: number;
  spread?: number;
}

const props = withDefaults(defineProps<ShimmerProps>(), {
  as: "p",
  duration: 2,
  spread: 2,
});

const slots = useSlots();

const textContent = computed(() => {
  const defaultSlot = slots.default?.();

  if (!defaultSlot?.length) {
    return "";
  }

  return defaultSlot
    .map((vnode) => {
      if (typeof vnode.children === "string") {
        return vnode.children;
      }

      return "";
    })
    .join("");
});

const dynamicSpread = computed(() => `${textContent.value.length * props.spread}px`);

const componentClasses = computed(() =>
  cn(
    "willow-shimmer relative inline-block bg-[length:250%_100%,auto] bg-clip-text text-transparent",
    props.class,
  ),
);

const componentStyle = computed(
  (): CSSProperties => ({
    "--willow-shimmer-spread": dynamicSpread.value,
    "--willow-shimmer-duration": `${props.duration}s`,
  }),
);
</script>

<template>
  <component :is="as" :class="componentClasses" :style="componentStyle">
    <slot />
  </component>
</template>

<style scoped>
.willow-shimmer {
  --willow-shimmer-bg: linear-gradient(
    90deg,
    transparent calc(50% - var(--willow-shimmer-spread)),
    var(--background),
    transparent calc(50% + var(--willow-shimmer-spread))
  );
  background-image:
    var(--willow-shimmer-bg), linear-gradient(var(--muted-foreground), var(--muted-foreground));
  background-position:
    100% center,
    center;
  background-repeat: no-repeat, no-repeat;
  animation: willow-shimmer var(--willow-shimmer-duration) linear infinite;
}

@keyframes willow-shimmer {
  to {
    background-position:
      0% center,
      center;
  }
}

@media (prefers-reduced-motion: reduce) {
  .willow-shimmer {
    animation: none;
  }
}
</style>
