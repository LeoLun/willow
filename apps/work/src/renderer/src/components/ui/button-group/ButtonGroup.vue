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
  width: 40px;
  min-width: 40px;
  height: 36px;
  padding: 0;
  border-radius: 9999px;
}

[data-shape="circular"] :deep(> [data-slot="button"] svg) {
  width: 18px;
  height: 18px;
}

[data-shape="capsule"] :deep(> [data-slot="button"]) {
  width: 48px;
  min-width: 48px;
  height: 26px;
  padding: 0;
  border-radius: 9999px;
}

[data-shape="capsule"] :deep(> [data-slot="button"] svg) {
  width: 14px;
  height: 14px;
}

:global(.dark) [data-slot="button-group"] :deep(> [data-slot="button"]:hover) {
  background: rgb(255 255 255 / 14%);
}

:global(.dark) [data-slot="button-group"] :deep(> [data-slot="button"][data-state="on"]) {
  background: rgb(255 255 255 / 12%);
}
</style>
