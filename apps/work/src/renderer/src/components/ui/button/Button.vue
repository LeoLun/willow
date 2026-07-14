<script setup lang="ts">
import { LoaderCircle } from "lucide-vue-next";
import type { ButtonHTMLAttributes } from "vue";
import { computed } from "vue";
import { cn } from "@/lib/styles";
import type { ButtonVariants } from ".";
import { buttonVariants } from ".";

defineOptions({ inheritAttrs: false });

export interface ButtonProps {
  variant?: ButtonVariants["variant"];
  shape?: ButtonVariants["shape"];
  type?: ButtonHTMLAttributes["type"];
  disabled?: boolean;
  loading?: boolean;
  pressed?: boolean;
  class?: ButtonHTMLAttributes["class"];
}

const props = withDefaults(defineProps<ButtonProps>(), {
  variant: "default",
  shape: "capsule",
  type: "button",
  disabled: false,
  loading: false,
  pressed: undefined,
});

const isDisabled = computed(() => props.disabled || props.loading);
</script>

<template>
  <button
    data-slot="button"
    :data-variant="variant"
    :data-shape="shape"
    :data-state="pressed === undefined ? undefined : pressed ? 'on' : 'off'"
    :type="type"
    :disabled="isDisabled"
    :aria-busy="loading || undefined"
    :aria-pressed="pressed"
    :class="cn(buttonVariants({ variant, shape }), props.class)"
    v-bind="$attrs"
  >
    <LoaderCircle v-if="loading" aria-hidden="true" class="animate-spin" />
    <slot />
  </button>
</template>
