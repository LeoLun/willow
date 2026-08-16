<script setup lang="ts">
import type { HoverCardRootEmits, HoverCardRootProps } from "reka-ui";
import { HoverCardRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<HoverCardRootProps>();
const emits = defineEmits<HoverCardRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);

defineSlots<{
  /**
   * `open` 为当前 HoverCard 的打开状态。
   */
  default: (props: { open: boolean }) => unknown
}>();
</script>

<template>
  <HoverCardRoot
    v-slot="{ open }"
    data-slot="hover-card"
    v-bind="forwarded"
  >
    <slot :open="open" />
  </HoverCardRoot>
</template>
