<script setup lang="ts">
import type { NavigationMenuRootEmits, NavigationMenuRootProps } from "reka-ui";
import { NavigationMenuRoot, useForwardPropsEmits } from "reka-ui";

const props = defineProps<NavigationMenuRootProps>();
const emits = defineEmits<NavigationMenuRootEmits>();

const forwarded = useForwardPropsEmits(props, emits);
</script>

<template>
  <NavigationMenuRoot v-slot="slotProps" data-slot="navigation-menu" v-bind="forwarded">
    <slot v-bind="slotProps" />
  </NavigationMenuRoot>
</template>
