<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { NavigationMenuListProps } from "reka-ui";
import { NavigationMenuList, useForwardProps } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { cn } from "../../../lib/utils";

const props = defineProps<
  NavigationMenuListProps & {
    class?: HTMLAttributes["class"];
  }
>();

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardProps(delegatedProps);
</script>

<template>
  <NavigationMenuList
    data-slot="navigation-menu-list"
    v-bind="forwarded"
    :class="cn('flex list-none items-center gap-1', props.class)"
  >
    <slot />
  </NavigationMenuList>
</template>
