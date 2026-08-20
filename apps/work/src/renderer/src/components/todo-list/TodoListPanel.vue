<script setup lang="ts">
import type { TodoItem, TodoStatus } from "@willow/core";
import { CircleCheckIcon, CircleIcon, LoaderCircleIcon } from "lucide-vue-next";
import { computed, ref, type Component, useId } from "vue";

const props = defineProps<{
  items: readonly TodoItem[];
}>();

const completedCount = computed(() =>
  props.items.reduce((count, item) => count + (item.status === "done" ? 1 : 0), 0),
);
const currentStep = computed(() => {
  const activeIndex = props.items.findIndex((item) => item.status === "in_progress");
  if (activeIndex >= 0) return activeIndex + 1;

  const pendingIndex = props.items.findIndex((item) => item.status === "pending");
  return pendingIndex >= 0 ? pendingIndex + 1 : props.items.length;
});
const open = ref(false);
const detailsId = useId();

function statusIcon(status: TodoStatus): Component {
  if (status === "done") return CircleCheckIcon;
  if (status === "in_progress") return LoaderCircleIcon;
  return CircleIcon;
}

function statusLabel(status: TodoStatus): string {
  if (status === "done") return "已完成";
  if (status === "in_progress") return "进行中";
  return "待处理";
}

function handleFocusOut(event: FocusEvent): void {
  const nextTarget = event.relatedTarget;
  const container = event.currentTarget as HTMLElement;
  if (!(nextTarget instanceof Node) || !container.contains(nextTarget)) {
    open.value = false;
  }
}
</script>

<template>
  <section
    v-if="props.items.length > 0"
    class="relative z-20 mx-auto mb-2 flex justify-center"
    data-slot="todo-list-panel"
    @mouseenter="open = true"
    @mouseleave="open = false"
  >
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="translate-y-1 opacity-0"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="translate-y-1 opacity-0"
    >
      <div
        v-show="open"
        :id="detailsId"
        class="absolute bottom-full left-1/2 max-w-128 min-w-64 -translate-x-1/2 pb-2"
        data-slot="todo-list-details"
        :data-state="open ? 'open' : 'closed'"
        role="tooltip"
      >
        <ul
          class="max-h-48 space-y-1 overflow-y-auto rounded-2xl border border-border bg-popover px-3 py-2 text-popover-foreground shadow-xl"
          aria-live="polite"
        >
          <li
            v-for="(item, index) in props.items"
            :key="`${index}:${item.title}`"
            class="flex min-w-0 items-start gap-2 rounded-lg px-1.5 py-1 text-xs"
            :class="item.status === 'in_progress' ? 'bg-primary/5 text-foreground' : ''"
            data-slot="todo-list-item"
            :data-status="item.status"
          >
            <component
              :is="statusIcon(item.status)"
              class="mt-0.5 size-4 shrink-0"
              :class="{
                'text-primary motion-reduce:animate-none': item.status === 'in_progress',
                'animate-spin': item.status === 'in_progress',
                'text-muted-foreground': item.status === 'pending',
                'text-emerald-500': item.status === 'done',
              }"
              aria-hidden="true"
            />
            <span
              class="min-w-0 flex-1 break-words"
              :class="item.status === 'done' ? 'text-muted-foreground line-through' : ''"
            >
              {{ item.title }}
            </span>
            <span class="sr-only">{{ statusLabel(item.status) }}</span>
          </li>
        </ul>
      </div>
    </Transition>

    <button
      type="button"
      class="inline-flex items-center gap-2 rounded-full border border-border bg-background/95 px-3 py-2 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
      data-slot="todo-list-trigger"
      :aria-controls="detailsId"
      :aria-expanded="open"
      :aria-label="`任务进度：第 ${currentStep} 步，共 ${props.items.length} 步，已完成 ${completedCount} 项`"
      @focusin="open = true"
      @focusout="handleFocusOut"
    >
      <LoaderCircleIcon
        v-if="completedCount < props.items.length"
        class="size-3 animate-spin text-primary motion-reduce:animate-none"
        aria-hidden="true"
      />
      <CircleCheckIcon v-else class="size-3 text-emerald-500" aria-hidden="true" />
      <span class="tabular-nums" data-slot="todo-list-count">
        第 {{ currentStep }} / {{ props.items.length }} 步
      </span>
    </button>
  </section>
</template>
