<script setup lang="ts">
import { Clock } from "lucide-vue-next";
import { computed, nextTick, ref, watch } from "vue";
import type { HTMLAttributes } from "vue";
import { cn } from "../../../lib/utils";
import { Button } from "../button";
import { Label } from "../label";
import { Popover, PopoverContent, PopoverTrigger } from "../popover";

const HOURS = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const props = withDefaults(
  defineProps<{
    /** 24 小时制时间，格式为 "HH:mm"。 */
    modelValue?: string;
    disabled?: boolean;
    class?: HTMLAttributes["class"];
  }>(),
  {
    modelValue: "09:00",
    disabled: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const hourValue = computed(() => parsePart(props.modelValue, 0, 23));
const minuteValue = computed(() => parsePart(props.modelValue, 1, 59));

function parsePart(value: string, index: 0 | 1, max: number) {
  const part = Number.parseInt(String(value ?? "").split(":")[index] ?? "", 10);
  if (Number.isNaN(part)) return "00";
  return String(Math.min(Math.max(part, 0), max)).padStart(2, "0");
}

function updateHour(value: string) {
  emit("update:modelValue", `${value}:${minuteValue.value}`);
}

function updateMinute(value: string) {
  emit("update:modelValue", `${hourValue.value}:${value}`);
}

const open = ref(false);
const hourListRef = ref<HTMLElement>();
const minuteListRef = ref<HTMLElement>();

watch(open, (isOpen) => {
  if (!isOpen) return;
  nextTick(() => {
    hourListRef.value
      ?.querySelector(`[data-hour="${hourValue.value}"]`)
      ?.scrollIntoView({ block: "center" });
    minuteListRef.value
      ?.querySelector(`[data-minute="${minuteValue.value}"]`)
      ?.scrollIntoView({ block: "center" });
  });
});
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="outline"
        :disabled="disabled"
        :class="cn('w-fit justify-start gap-2 font-normal tabular-nums', props.class)"
      >
        <Clock class="size-4 text-muted-foreground" />
        {{ hourValue }}:{{ minuteValue }}
      </Button>
    </PopoverTrigger>

    <PopoverContent class="w-auto p-3" align="start">
      <div class="grid grid-cols-2 gap-3">
        <div class="grid gap-2">
          <Label class="px-1">小时</Label>
          <div ref="hourListRef" class="max-h-36 w-16 overflow-y-auto rounded-md p-1">
            <button
              v-for="hour in HOURS"
              :key="hour"
              type="button"
              :data-hour="hour"
              :disabled="disabled"
              :class="
                cn(
                  'flex w-full items-center justify-center rounded-sm py-1 text-sm tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
                  hour === hourValue && 'bg-accent font-medium text-accent-foreground',
                )
              "
              @click="updateHour(hour)"
            >
              {{ hour }}
            </button>
          </div>
        </div>
        <div class="grid gap-2">
          <Label class="px-1">分钟</Label>
          <div ref="minuteListRef" class="max-h-36 w-16 overflow-y-auto rounded-md p-1">
            <button
              v-for="minute in MINUTES"
              :key="minute"
              type="button"
              :data-minute="minute"
              :disabled="disabled"
              :class="
                cn(
                  'flex w-full items-center justify-center rounded-sm py-1 text-sm tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground disabled:pointer-events-none disabled:opacity-50',
                  minute === minuteValue && 'bg-accent font-medium text-accent-foreground',
                )
              "
              @click="updateMinute(minute)"
            >
              {{ minute }}
            </button>
          </div>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
