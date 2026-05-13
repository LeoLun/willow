<script setup lang="ts">
import { Input } from "@willow/shadcn/components/ui/input";
import type { HTMLAttributes } from "vue";
import { cn } from "../../../lib/utils";

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();
</script>

<template>
  <Input
    data-slot="sidebar-input"
    data-sidebar="input"
    :class="cn('h-8 w-full bg-background shadow-none', props.class)"
  >
    <slot />
  </Input>
</template>
