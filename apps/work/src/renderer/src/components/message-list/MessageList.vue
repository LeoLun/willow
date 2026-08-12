<script setup lang="ts">
import { defaultRangeExtractor, useVirtualizer } from "@tanstack/vue-virtual";
import { computed, type StyleValue } from "vue";
import Loading from "@/components/ui/Loading.vue";
import { groupMessagesIntoTurns } from "./message-turns";
import MessageTurn from "./MessageTurn.vue";
import type { Message } from "./types";

const VIRTUALIZATION_THRESHOLD = 40;
const ESTIMATED_TURN_HEIGHT = 180;

const props = withDefaults(
  defineProps<{
    messages: readonly Message[];
    streaming?: boolean;
    scrollElement?: HTMLElement;
  }>(),
  { streaming: false, scrollElement: undefined },
);

const turns = computed(() => groupMessagesIntoTurns(props.messages));
const virtualized = computed(
  () => props.scrollElement !== undefined && turns.value.length > VIRTUALIZATION_THRESHOLD,
);
const virtualizer = useVirtualizer(
  computed(() => ({
    count: virtualized.value ? turns.value.length : 0,
    estimateSize: () => ESTIMATED_TURN_HEIGHT,
    getItemKey: (index: number) => turns.value[index]?.key ?? index,
    getScrollElement: () => props.scrollElement ?? null,
    initialRect: {
      height: props.scrollElement?.clientHeight ?? 0,
      width: props.scrollElement?.clientWidth ?? 0,
    },
    overscan: 3,
    rangeExtractor: (range) => {
      const indexes = defaultRangeExtractor(range);
      const activeIndex = turns.value.length - 1;
      if (props.streaming && activeIndex >= 0 && !indexes.includes(activeIndex)) {
        indexes.push(activeIndex);
      }
      return indexes;
    },
  })),
);
const virtualItems = computed(() => virtualizer.value.getVirtualItems());
const renderedVirtualItems = computed(() => {
  if (virtualItems.value.length > 0) return virtualItems.value;
  const indexes = Array.from({ length: Math.min(4, turns.value.length) }, (_, index) => index);
  const activeIndex = turns.value.length - 1;
  if (props.streaming && activeIndex >= 0 && !indexes.includes(activeIndex))
    indexes.push(activeIndex);
  return indexes.map((index) => ({
    index,
    key: turns.value[index]?.key ?? index,
    start: index * ESTIMATED_TURN_HEIGHT,
    end: (index + 1) * ESTIMATED_TURN_HEIGHT,
    size: ESTIMATED_TURN_HEIGHT,
    lane: 0,
  }));
});
const virtualContainerStyle = computed<StyleValue>(() => ({
  height: `${virtualizer.value.getTotalSize() || turns.value.length * ESTIMATED_TURN_HEIGHT}px`,
  position: "relative",
  width: "100%",
}));

function turnStyle(start: number): StyleValue {
  return {
    left: 0,
    position: "absolute",
    top: 0,
    transform: `translateY(${start}px)`,
    width: "100%",
  };
}
</script>

<template>
  <div class="flex flex-col gap-2" data-slot="message-list">
    <template v-if="virtualized">
      <div :style="virtualContainerStyle" data-slot="virtual-message-list">
        <div
          v-for="item in renderedVirtualItems"
          :key="String(item.key)"
          :ref="(element) => element && virtualizer.measureElement(element as Element)"
          :data-index="item.index"
          :style="turnStyle(item.start)"
        >
          <MessageTurn
            :messages="turns[item.index]?.messages ?? []"
            :streaming="props.streaming && item.index === turns.length - 1"
          />
        </div>
      </div>
    </template>
    <template v-else>
      <MessageTurn
        v-for="(turn, index) in turns"
        :key="turn.key"
        :messages="turn.messages"
        :streaming="props.streaming && index === turns.length - 1"
      />
    </template>

    <div
      v-if="props.streaming"
      class="flex items-center gap-3 py-0.5 text-muted-foreground"
      role="status"
      aria-label="正在工作中"
      data-slot="message-list-working"
    >
      <Loading class="size-3 shrink-0" aria-hidden="true" />
      <span class="shimmer text-sm" aria-hidden="true" data-slot="message-list-working-label">
        正在工作中
      </span>
    </div>
  </div>
</template>
