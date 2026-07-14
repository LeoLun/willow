<script setup lang="ts">
import type { HTMLAttributes } from "vue";
import { cn } from "@/lib/styles";
import { buttonGroupVariants } from ".";

export interface ButtonGroupProps {
  shape?: "circular" | "capsule";
  class?: HTMLAttributes["class"];
}

const props = withDefaults(defineProps<ButtonGroupProps>(), {
  shape: "capsule",
});
</script>

<template>
  <div
    data-slot="button-group"
    :data-shape="shape"
    role="group"
    :class="cn(buttonGroupVariants({ shape }), props.class)"
  >
    <slot />
  </div>
</template>

<style scoped>
[data-slot="button-group"] :deep(> [data-slot="button"]) {
  z-index: 1;
  border-color: transparent;
  background: transparent;
  box-shadow: none;
  backdrop-filter: none;
}

[data-slot="button-group"] :deep(> [data-slot="button"]::before) {
  display: none;
}

[data-slot="button-group"] :deep(> [data-slot="button"]:hover) {
  background: rgb(0 0 0 / 6%);
}

[data-slot="button-group"] :deep(> [data-slot="button"][data-state="on"]) {
  background: rgb(0 0 0 / 9%);
}

[data-shape="circular"] :deep(> [data-slot="button"]) {
  width: 56px;
  min-width: 56px;
  height: calc(var(--spacing) * 12);
  padding: 0;
  border-radius: 9999px;
}

[data-shape="circular"] :deep(> [data-slot="button"] svg) {
  width: 24px;
  height: 24px;
}

[data-shape="capsule"] :deep(> [data-slot="button"]) {
  width: 60px;
  min-width: 60px;
  height: calc(var(--spacing) * 9);
  padding: 0;
  border-radius: 9999px;
}

[data-shape="capsule"] :deep(> [data-slot="button"] svg) {
  width: 20px;
  height: 20px;
}

:global(.dark) [data-slot="button-group"] :deep(> [data-slot="button"]:hover) {
  background: rgb(255 255 255 / 10%);
}

:global(.dark) [data-slot="button-group"] :deep(> [data-slot="button"][data-state="on"]) {
  background: rgb(255 255 255 / 8%);
}
</style>
