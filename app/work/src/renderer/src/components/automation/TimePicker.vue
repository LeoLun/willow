<script setup lang="ts">
import { useVModel } from "@vueuse/core";
import { Check, Clock3, ChevronsUpDown } from "lucide-vue-next";
import { computed, nextTick, ref, watch } from "vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    class?: string;
  }>(),
  {
    modelValue: "09:00",
  },
);

const emits = defineEmits<{
  (e: "update:modelValue", value: string): void;
}>();

const open = ref(false);
const hourColumnRef = ref<HTMLElement | null>(null);
const minuteColumnRef = ref<HTMLElement | null>(null);
const modelValue = useVModel(props, "modelValue", emits, {
  passive: true,
  defaultValue: props.modelValue,
});

const hours = Array.from({ length: 24 }, (_, index) => String(index).padStart(2, "0"));
const minutes = Array.from({ length: 60 }, (_, index) => String(index).padStart(2, "0"));

const selectedHour = computed(() => modelValue.value.split(":")[0] ?? "09");
const selectedMinute = computed(() => modelValue.value.split(":")[1] ?? "00");

const displayLabel = computed(() => `${selectedHour.value}:${selectedMinute.value}`);

watch(open, async (isOpen) => {
  if (!isOpen) {
    return;
  }

  await nextTick();
  scrollSelectedIntoView(hourColumnRef.value, "hour", selectedHour.value);
  scrollSelectedIntoView(minuteColumnRef.value, "minute", selectedMinute.value);
});

function updateHour(hour: string) {
  modelValue.value = `${hour}:${selectedMinute.value}`;
}

function updateMinute(minute: string) {
  modelValue.value = `${selectedHour.value}:${minute}`;
}

function scrollSelectedIntoView(
  column: HTMLElement | null,
  type: "hour" | "minute",
  value: string,
) {
  const viewport = column?.querySelector<HTMLElement>("[data-slot='scroll-area-viewport']");
  const selectedItem = column?.querySelector<HTMLElement>(
    `[data-time-part="${type}"][data-time-value="${value}"]`,
  );

  if (!viewport || !selectedItem) {
    return;
  }

  const offset = selectedItem.offsetTop - viewport.clientHeight / 2 + selectedItem.clientHeight / 2;
  viewport.scrollTo({
    top: Math.max(offset, 0),
    behavior: "auto",
  });
}
</script>

<template>
  <DropdownMenu v-model:open="open">
    <DropdownMenuTrigger as-child>
      <Button
        type="button"
        variant="outline"
        :class="
          cn(
            'h-11 w-full justify-between px-3 text-left text-base font-normal md:text-sm',
            props.class,
          )
        "
      >
        <span class="flex items-center gap-2">
          <Clock3 class="size-4 text-muted-foreground" />
          <span>{{ displayLabel }}</span>
        </span>
        <ChevronsUpDown class="size-4 shrink-0 opacity-60" />
      </Button>
    </DropdownMenuTrigger>

    <DropdownMenuContent align="start" class="w-[20rem] rounded-lg p-0">
      <div class="grid grid-cols-[1fr_1fr] gap-0">
        <div ref="hourColumnRef" class="border-r">
          <div class="px-4 py-2 text-xs font-medium text-muted-foreground">小时</div>
          <ScrollArea class="h-64">
            <div class="grid gap-1 p-2">
              <Button
                v-for="hour in hours"
                :key="hour"
                :data-time-part="'hour'"
                :data-time-value="hour"
                type="button"
                :variant="hour === selectedHour ? 'secondary' : 'ghost'"
                class="justify-between"
                @click="updateHour(hour)"
              >
                <span>{{ hour }}</span>
                <Check v-if="hour === selectedHour" class="size-4 text-primary" />
              </Button>
            </div>
          </ScrollArea>
        </div>

        <div ref="minuteColumnRef">
          <div class="px-4 py-2 text-xs font-medium text-muted-foreground">分钟</div>
          <ScrollArea class="h-64">
            <div class="grid gap-1 p-2">
              <Button
                v-for="minute in minutes"
                :key="minute"
                :data-time-part="'minute'"
                :data-time-value="minute"
                type="button"
                :variant="minute === selectedMinute ? 'secondary' : 'ghost'"
                class="justify-between"
                @click="updateMinute(minute)"
              >
                <span>{{ minute }}</span>
                <Check v-if="minute === selectedMinute" class="size-4 text-primary" />
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
