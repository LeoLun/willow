<script setup lang="ts">
import { computed } from "vue";
import { getProviderInitials, resolveProviderIcon } from "./provider-display";

const props = defineProps<{
  providerId: string;
  name: string;
}>();

const icon = computed(() => resolveProviderIcon(props.providerId));
const initials = computed(() => getProviderInitials(props.name));
</script>

<template>
  <span
    class="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-background text-xs font-semibold text-muted-foreground"
    aria-hidden="true"
  >
    <component :is="icon" v-if="icon" class="size-5" />
    <template v-else>{{ initials }}</template>
  </span>
</template>
