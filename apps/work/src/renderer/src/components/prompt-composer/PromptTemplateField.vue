<script setup lang="ts">
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { CheckIcon, ChevronDownIcon } from "lucide-vue-next";
import { computed } from "vue";
import type { ComposerTemplateSegment } from "./types";

type FieldSegment = Exclude<ComposerTemplateSegment, { type: "text" }>;

const props = defineProps<{
  segment: FieldSegment;
  value: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  "update:value": [value: string];
}>();

const selectedLabel = computed(() => {
  if (props.segment.type !== "select") return "";
  return props.segment.options.find((option) => option.value === props.value)?.label ?? "";
});

function updateInput(event: Event): void {
  const input = event.currentTarget as HTMLInputElement;
  const inputEvent = event as InputEvent;
  if (inputEvent.isComposing) return;
  emit("update:value", input.value);
}

function finishComposition(event: CompositionEvent): void {
  emit("update:value", (event.currentTarget as HTMLInputElement).value);
}

function updateSelection(value: unknown): void {
  if (typeof value === "string") emit("update:value", value);
}
</script>

<template>
  <input
    v-if="props.segment.type === 'input'"
    data-template-control
    type="text"
    :value="props.value"
    :placeholder="props.segment.placeholder"
    :aria-label="props.segment.placeholder"
    :disabled="props.disabled"
    autocomplete="off"
    class="mx-0.5 inline-block field-sizing-content max-w-full min-w-24 rounded-md border border-input bg-muted/60 px-2 py-0.5 text-sm leading-5 text-foreground shadow-none transition-[border-color,box-shadow,background-color] outline-none placeholder:text-muted-foreground focus:bg-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"
    @input="updateInput"
    @compositionend="finishComposition"
  />
  <DropdownMenu v-else>
    <DropdownMenuTrigger as-child>
      <button
        type="button"
        data-template-control
        :aria-label="props.segment.placeholder"
        :disabled="props.disabled"
        class="mx-0.5 inline-flex max-w-full items-center gap-1 rounded-md border border-input bg-muted/60 px-2 py-0.5 text-sm leading-5 text-foreground transition-[border-color,box-shadow,background-color] outline-none hover:bg-muted focus:bg-background disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20"
      >
        <span :class="selectedLabel ? 'text-foreground' : 'text-muted-foreground'">
          {{ selectedLabel || props.segment.placeholder }}
        </span>
        <ChevronDownIcon class="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
      </button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start" class="max-w-80">
      <DropdownMenuRadioGroup :model-value="props.value" @update:model-value="updateSelection">
        <DropdownMenuRadioItem
          v-for="option in props.segment.options"
          :key="option.value"
          :value="option.value"
          :data-template-option-value="option.value"
          class="pr-8 pl-2 text-sm [&>span:first-child]:right-2 [&>span:first-child]:left-auto"
        >
          {{ option.label }}
          <template #indicator-icon>
            <CheckIcon class="size-4" />
          </template>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
