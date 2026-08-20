<script setup lang="ts">
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@willow/shadcn/components/ui/hover-card";
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";
import type { FocusRailItem } from "./types";

interface FocusRailProps {
  /**
   * Rail 数据
   */
  items: FocusRailItem[];

  /**
   * 外部受控 activeId
   */
  activeId?: string;

  /**
   * Rail 与浏览器左边缘的距离
   */
  offsetLeft?: number;

  /**
   * Hover 打开延迟
   */
  openDelay?: number;

  /**
   * Hover 关闭延迟
   */
  closeDelay?: number;

  /**
   * 点击后是否自动滚动到目标节点
   */
  scrollToTarget?: boolean;

  /**
   * 页面滚动时是否自动计算 active item
   */
  autoTrack?: boolean;

  /**
   * IntersectionObserver 根元素；不传时以视口为根。
   * 页面内容滚动发生在自定义滚动容器时传入该容器，保证 active 判定准确。
   */
  root?: Element;

  /**
   * Scroll Into View 行为
   */
  scrollBehavior?: ScrollBehavior;
}

const props = withDefaults(defineProps<FocusRailProps>(), {
  offsetLeft: 20,
  openDelay: 80,
  closeDelay: 180,
  scrollToTarget: true,
  autoTrack: true,
  scrollBehavior: "smooth",
});

const emit = defineEmits<{
  "update:activeId": [id: string];
  select: [item: FocusRailItem];
  hover: [item: FocusRailItem];
}>();

defineSlots<{
  content: (props: { item: FocusRailItem }) => unknown;
}>();

const internalActiveId = ref<string>();
const isProgrammaticScrolling = ref(false);
const railContainer = ref<HTMLElement>();
const openItemIndex = ref<number>();

let observer: IntersectionObserver | undefined;
let programmaticScrollTimer: ReturnType<typeof setTimeout> | undefined;
const observedTargets = new Set<Element>();
let targetSyncFrame: number | undefined;
let removeScrollListener: (() => void) | undefined;

const currentActiveId = computed(() => props.activeId ?? internalActiveId.value);

function targetIdFor(item: FocusRailItem): string {
  return item.targetId ?? item.id;
}

function setActive(id: string) {
  internalActiveId.value = id;
  emit("update:activeId", id);
}

function handleSelect(item: FocusRailItem) {
  if (item.disabled) return;

  setActive(item.id);
  emit("select", item);

  if (!props.scrollToTarget) return;

  const target = document.getElementById(targetIdFor(item));

  if (!target) return;

  // 平滑滚动过程中 IntersectionObserver 会依次经过多个 section，
  // 短暂抑制自动追踪，避免 Active 被临时切走再切回。
  isProgrammaticScrolling.value = true;
  clearTimeout(programmaticScrollTimer);
  programmaticScrollTimer = setTimeout(() => {
    isProgrammaticScrolling.value = false;
  }, 500);

  target.scrollIntoView({
    behavior: props.scrollBehavior,
    block: "center",
  });
}

function setupObserver() {
  observer?.disconnect();
  observedTargets.clear();
  observer = undefined;

  if (!props.autoTrack) return;

  observer = new IntersectionObserver(
    (entries) => {
      if (isProgrammaticScrolling.value) return;

      const intersectingIds = new Set<string>();

      for (const entry of entries) {
        if (entry.isIntersecting) intersectingIds.add(entry.target.id);
      }

      if (intersectingIds.size === 0) return;

      // 多个 section 同时位于中间区域时，取 items 顺序靠后的（页面下方）为准。
      for (const item of props.items) {
        if (intersectingIds.has(targetIdFor(item))) setActive(item.id);
      }
    },
    {
      root: props.root ?? null,
      rootMargin: "-40% 0px -40% 0px",
      threshold: 0,
    },
  );

  for (const item of props.items) {
    const target = document.getElementById(targetIdFor(item));

    if (target) {
      observer.observe(target);
      observedTargets.add(target);
    }
  }
}

function handleRootScroll() {
  if (targetSyncFrame !== undefined) return;

  targetSyncFrame = requestAnimationFrame(() => {
    targetSyncFrame = undefined;
    syncObservedTargets();
    syncActiveAtScrollBoundary();
  });
}

function syncActiveAtScrollBoundary() {
  if (!props.autoTrack || props.items.length === 0) return;

  const scrollTarget = props.root;
  const scrollTop = scrollTarget
    ? scrollTarget.scrollTop
    : window.scrollY || document.documentElement.scrollTop;
  const scrollHeight = scrollTarget
    ? scrollTarget.scrollHeight
    : document.documentElement.scrollHeight;
  const clientHeight = scrollTarget ? scrollTarget.clientHeight : window.innerHeight;

  let boundaryItem: FocusRailItem | undefined;

  if (scrollTop <= 1) boundaryItem = props.items.find((item) => !item.disabled);
  else if (scrollTop + clientHeight >= scrollHeight - 1)
    boundaryItem = props.items.findLast((item) => !item.disabled);

  if (boundaryItem && currentActiveId.value !== boundaryItem.id) setActive(boundaryItem.id);
}

function syncObservedTargets() {
  if (!props.autoTrack) return;

  const desiredIds = new Set<string>();

  for (const item of props.items) {
    const target = document.getElementById(targetIdFor(item));

    if (target) desiredIds.add(target.id);
  }

  let changed = desiredIds.size !== observedTargets.size;

  if (!changed) {
    for (const element of observedTargets) {
      if (!desiredIds.has(element.id)) {
        changed = true;
        break;
      }
    }
  }

  if (changed) setupObserver();
}

function bindScrollListener() {
  removeScrollListener?.();
  removeScrollListener = undefined;

  const scrollTarget = props.root ?? window;
  scrollTarget.addEventListener("scroll", handleRootScroll, { passive: true });
  removeScrollListener = () => {
    scrollTarget.removeEventListener("scroll", handleRootScroll);
  };
}

function scrollActiveRailItemIntoView() {
  const container = railContainer.value;
  const activeId = currentActiveId.value;

  if (!container || !activeId) return;

  let itemEl: HTMLElement | undefined;

  for (const el of container.querySelectorAll<HTMLElement>("[data-rail-id]")) {
    if (el.dataset.railId === activeId) {
      itemEl = el;
      break;
    }
  }

  if (!itemEl) return;

  const containerRect = container.getBoundingClientRect();
  const itemRect = itemEl.getBoundingClientRect();

  if (itemRect.top < containerRect.top) {
    container.scrollTo({
      top: container.scrollTop + itemRect.top - containerRect.top - 8,
      behavior: "smooth",
    });
  } else if (itemRect.bottom > containerRect.bottom) {
    container.scrollTo({
      top: container.scrollTop + itemRect.bottom - containerRect.bottom + 8,
      behavior: "smooth",
    });
  }
}

function lineClass(item: FocusRailItem, open: boolean): string[] {
  const isActive = currentActiveId.value === item.id;
  const baseWidth = item.level === 1 ? "w-10" : item.level === 3 ? "w-4" : "w-7";

  if (open) {
    return ["w-10", "bg-foreground", isActive ? "opacity-100" : "opacity-80"];
  }

  return [
    baseWidth,
    isActive ? "bg-foreground" : "bg-muted-foreground/30",
    isActive ? "opacity-100" : "group-hover:bg-muted-foreground/70",
  ];
}

function railLineClass(item: FocusRailItem, open: boolean, index: number): string[] {
  const classes = lineClass(item, open);
  const currentOpenIndex = openItemIndex.value;

  if (currentOpenIndex === undefined || open) return classes;

  const distance = Math.abs(index - currentOpenIndex);
  const widthClass = distance === 1 ? "w-7" : distance === 2 ? "w-5" : "w-4";
  return [widthClass, ...classes.filter((className) => !className.startsWith("w-"))];
}

function handleOpenChange(index: number, open: boolean): void {
  if (open) {
    openItemIndex.value = index;
  } else if (openItemIndex.value === index) {
    openItemIndex.value = undefined;
  }
}

const itemTargetKeys = computed(() =>
  props.items.map((item) => `${item.id}:${targetIdFor(item)}:${item.disabled ? 1 : 0}`).join(","),
);

watch(
  () => [itemTargetKeys.value, props.autoTrack],
  () => setupObserver(),
);

watch(
  () => props.root,
  () => {
    setupObserver();
    bindScrollListener();
  },
);

watch(currentActiveId, () => {
  void nextTick(scrollActiveRailItemIntoView);
});

onMounted(() => {
  setupObserver();
  bindScrollListener();
});

onBeforeUnmount(() => {
  observer?.disconnect();
  removeScrollListener?.();

  if (targetSyncFrame !== undefined) cancelAnimationFrame(targetSyncFrame);

  if (programmaticScrollTimer) clearTimeout(programmaticScrollTimer);
});
</script>

<template>
  <aside
    data-slot="focus-rail"
    aria-label="内容导航"
    class="fixed top-1/2 z-50 hidden -translate-y-1/2 md:block"
    :style="{ left: `${offsetLeft}px` }"
  >
    <div
      ref="railContainer"
      data-slot="focus-rail-scroll"
      class="max-h-[70vh] overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <div class="flex flex-col items-start gap-0.5">
        <HoverCard
          v-for="(item, index) in items"
          :key="item.id"
          v-slot="{ open }"
          :open="openItemIndex === index"
          :open-delay="openDelay"
          :close-delay="closeDelay"
          @update:open="handleOpenChange(index, $event)"
        >
          <HoverCardTrigger as-child>
            <button
              type="button"
              data-slot="focus-rail-item"
              :data-rail-id="item.id"
              :disabled="item.disabled"
              :aria-label="item.title"
              :aria-current="currentActiveId === item.id ? 'true' : undefined"
              class="group flex h-3 w-12 cursor-pointer items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-20"
              @click="handleSelect(item)"
              @mouseenter="emit('hover', item)"
            >
              <span
                data-slot="focus-rail-line"
                class="block h-[3px] rounded-full transition-[width,background-color,opacity] duration-200 ease-out"
                :class="railLineClass(item, open, index)"
              />
            </button>
          </HoverCardTrigger>

          <HoverCardContent
            side="right"
            align="center"
            :side-offset="12"
            :animated="false"
            class="h-28 w-80 max-w-[calc(100vw-104px)] overflow-hidden rounded-xl border bg-popover/95 p-3 shadow-lg backdrop-blur-md"
          >
            <slot name="content" :item="item">
              <div class="space-y-3">
                <h3 class="truncate text-lg font-semibold tracking-tight">
                  {{ item.title }}
                </h3>

                <p v-if="item.summary" class="text-sm leading-6 text-muted-foreground">
                  {{ item.summary }}
                </p>

                <ul
                  v-if="item.details?.length"
                  class="space-y-2 pl-5 text-sm text-muted-foreground"
                >
                  <li v-for="detail in item.details" :key="detail" class="list-disc pl-1">
                    {{ detail }}
                  </li>
                </ul>
              </div>
            </slot>
          </HoverCardContent>
        </HoverCard>
      </div>
    </div>
  </aside>
</template>
