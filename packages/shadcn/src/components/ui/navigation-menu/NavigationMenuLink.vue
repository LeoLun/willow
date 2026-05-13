<script setup lang="ts">
import { reactiveOmit } from "@vueuse/core";
import type { NavigationMenuLinkEmits, NavigationMenuLinkProps } from "reka-ui";
import { NavigationMenuLink, useForwardPropsEmits } from "reka-ui";
import type { HTMLAttributes } from "vue";
import { navigationMenuLinkVariants } from ".";
import { cn } from "../../../lib/utils";

const props = defineProps<
  NavigationMenuLinkProps & {
    class?: HTMLAttributes["class"];
  }
>();
const emits = defineEmits<NavigationMenuLinkEmits>();

const delegatedProps = reactiveOmit(props, "class");
const forwarded = useForwardPropsEmits(delegatedProps, emits);
</script>

<template>
  <NavigationMenuLink
    data-slot="navigation-menu-link"
    v-bind="forwarded"
    :class="cn(navigationMenuLinkVariants(), props.class)"
  >
    <slot />
  </NavigationMenuLink>
</template>
