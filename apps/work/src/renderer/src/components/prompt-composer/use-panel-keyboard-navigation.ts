import { computed, nextTick, ref, watch } from "vue";
import type { ComputedRef, Ref, ShallowRef } from "vue";
import type { ComposerPanelNavigationKey } from "./types";

interface PanelKeyboardNavigationOptions<Item> {
  items: Ref<readonly Item[]> | ComputedRef<readonly Item[]>;
  itemId: (index: number) => string;
  list: ShallowRef<HTMLElement | undefined>;
  select: (item: Item) => void;
}

export function usePanelKeyboardNavigation<Item>({
  items,
  itemId,
  list,
  select,
}: PanelKeyboardNavigationOptions<Item>) {
  const activeIndex = ref(-1);
  const activeDescendant = computed(() =>
    activeIndex.value >= 0 ? itemId(activeIndex.value) : undefined,
  );

  function scrollActiveItemIntoView(): void {
    void nextTick(() => {
      list.value
        ?.querySelector<HTMLElement>("[data-active=true]")
        ?.scrollIntoView?.({ block: "nearest" });
    });
  }

  function setActiveIndex(index: number, scroll = false): void {
    activeIndex.value = index;
    if (scroll) scrollActiveItemIntoView();
  }

  function handlePanelKeydown(key: ComposerPanelNavigationKey): void {
    const currentItems = items.value;
    if (currentItems.length === 0) return;

    if (key === "Enter") {
      const item = currentItems[activeIndex.value];
      if (item) select(item);
      return;
    }

    const direction = key === "ArrowDown" ? 1 : -1;
    const currentIndex = activeIndex.value >= 0 ? activeIndex.value : key === "ArrowDown" ? -1 : 0;
    setActiveIndex((currentIndex + direction + currentItems.length) % currentItems.length, true);
  }

  watch(
    items,
    (currentItems) => {
      setActiveIndex(currentItems.length > 0 ? 0 : -1, currentItems.length > 0);
    },
    { immediate: true },
  );

  return {
    activeDescendant,
    activeIndex,
    handlePanelKeydown,
    setActiveIndex,
  };
}
