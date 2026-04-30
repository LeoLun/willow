<script setup lang="ts">
import { Collapsible, CollapsibleContent, CollapsibleTrigger, Shimmer } from "@willow/shadcn";
import { ChevronDown, ChevronRight } from "lucide-vue-next";
import { computed, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    title: string;
    stateLabel?: string;
    canExpand?: boolean;
    defaultOpen?: boolean;
    error?: boolean;
    disabled?: boolean;
    loading?: boolean;
  }>(),
  {
    canExpand: false,
    defaultOpen: false,
    error: false,
    disabled: false,
    loading: false,
  },
);

const open = ref(props.defaultOpen);

const isExpandable = computed(() => props.canExpand && !props.disabled);
const isLoading = computed(() => props.loading && !props.error && !props.disabled);

watch(
  () => props.defaultOpen,
  (nextDefaultOpen) => {
    open.value = nextDefaultOpen;
  },
);

watch(isExpandable, (nextExpandable) => {
  if (!nextExpandable) {
    open.value = false;
  }
});

function handleOpenChange(nextOpen: boolean) {
  open.value = isExpandable.value ? nextOpen : false;
}
</script>

<template>
  <Collapsible :open="open" @update:open="handleOpenChange">
    <div
      class="relative isolate min-w-0 overflow-hidden rounded-none border-0 bg-transparent p-0 text-card-foreground shadow-none"
      :class="error ? 'border-destructive/40' : 'border-border'"
      :data-loading="isLoading ? 'true' : undefined"
      data-willow-tool-card
    >
      <CollapsibleTrigger
        class="group c relative z-[1] flex min-h-[22px] w-full min-w-0 items-center gap-1.5 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        :disabled="!isExpandable"
      >
        <div class="flex max-w-[100%] min-w-0 flex-col gap-[5px]">
          <div class="flex min-h-[22px] min-w-0 items-center gap-2">
            <span class="shrink-0 [&_svg]:size-3.5">
              <slot name="icon" />
            </span>
            <Shimmer v-if="isLoading" as="span" class="min-w-0 flex-1 truncate text-sm leading-5">
              {{ title }}
            </Shimmer>
            <span
              v-else
              class="min-w-0 flex-1 truncate text-sm leading-5 text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground"
            >
              {{ title }}
            </span>
          </div>

          <slot name="summary" />
        </div>

        <span
          v-if="isExpandable"
          class="flex size-5 shrink-0 items-center justify-center text-muted-foreground transition-colors group-hover:text-foreground group-focus-visible:text-foreground"
        >
          <ChevronDown v-if="open" class="size-3.5" />
          <ChevronRight v-else class="size-3.5" />
        </span>
      </CollapsibleTrigger>

      <CollapsibleContent
        v-if="canExpand"
        class="relative z-[1] mt-[5px] border-t-0 border-border/60 pt-0"
      >
        <div class="flex flex-col gap-1.5">
          <slot name="details" />
        </div>
      </CollapsibleContent>
    </div>
  </Collapsible>
</template>
