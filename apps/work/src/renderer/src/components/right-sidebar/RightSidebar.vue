<script setup lang="ts">
import type { SkillInfo } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import { Plus, X } from "lucide-vue-next";
import { computed, nextTick, ref, shallowRef, watch } from "vue";
import type { ComposerPromptTemplate } from "@/components/prompt-composer";
import { getRightSidebarPanelDefinition, rightSidebarPanelDefinitions } from "./panel-registry";
import type {
  RightSidebarPanelKind,
  RightSidebarPanelState,
  RightSidebarTab,
  RuntimeSidebarPanelDefinition,
  SidebarPanelContext,
} from "./types";

const props = defineProps<{
  id: string;
  workspaceId?: number;
}>();

const emit = defineEmits<{
  "select-skill": [skill: SkillInfo, template?: ComposerPromptTemplate];
}>();

function selectSkill(skill: SkillInfo, template?: ComposerPromptTemplate): void {
  emit("select-skill", skill, template);
}

const tabs = shallowRef<RightSidebarTab[]>([]);
const activeTabId = ref<string>();
const sidebarRoot = shallowRef<HTMLElement>();
let nextTabId = 1;

const context = computed<SidebarPanelContext>(() => ({ workspaceId: props.workspaceId }));
const availableDefinitions = computed(() =>
  rightSidebarPanelDefinitions.filter(
    (definition) => definition.isAvailable?.(context.value) ?? true,
  ),
);
const emptyStateDefinitions = computed(() =>
  availableDefinitions.value.filter((definition) => definition.entryPoints.emptyState),
);
const addMenuDefinitions = computed(() =>
  availableDefinitions.value.filter((definition) => definition.entryPoints.addMenu),
);
const tabViews = computed(() =>
  tabs.value.map((tab) => {
    const definition = getRuntimeDefinition(tab.kind);
    return {
      definition,
      tab,
      title: definition.getTitle(tab.state),
    };
  }),
);

function getRuntimeDefinition(kind: RightSidebarPanelKind): RuntimeSidebarPanelDefinition {
  return getRightSidebarPanelDefinition(kind) as RuntimeSidebarPanelDefinition;
}

function openPanel(kind: RightSidebarPanelKind): void {
  const definition = getRuntimeDefinition(kind);
  if (!(definition.isAvailable?.(context.value) ?? true)) return;

  if (definition.multiplicity === "single") {
    const existingTab = tabs.value.find((tab) => tab.kind === kind);
    if (existingTab) {
      activateTab(existingTab.id, true);
      return;
    }
  }

  const tab = {
    id: `right-sidebar-tab-${nextTabId++}`,
    kind,
    state: definition.createState(context.value),
  } as RightSidebarTab;
  tabs.value = [...tabs.value, tab];
  activateTab(tab.id, true);
}

function activateTab(tabId: string, focus = false): void {
  if (!tabs.value.some((tab) => tab.id === tabId)) return;
  activeTabId.value = tabId;
  if (focus) focusTab(tabId);
}

function updateTabState(tabId: string, state: RightSidebarPanelState): void {
  tabs.value = tabs.value.map((tab) =>
    tab.id === tabId ? ({ ...tab, state } as RightSidebarTab) : tab,
  );
}

function closeTab(tabId: string, focusNext = true): void {
  const tabIndex = tabs.value.findIndex((tab) => tab.id === tabId);
  if (tabIndex < 0) return;

  const wasActive = activeTabId.value === tabId;
  const remainingTabs = tabs.value.filter((tab) => tab.id !== tabId);
  tabs.value = remainingTabs;

  if (!wasActive) return;
  const nextTab = remainingTabs[Math.min(tabIndex, remainingTabs.length - 1)];
  activeTabId.value = nextTab?.id;
  if (focusNext && nextTab) focusTab(nextTab.id);
}

function focusTab(tabId: string): void {
  void nextTick(() => {
    sidebarRoot.value
      ?.querySelector<HTMLButtonElement>(`[data-tab-activation="${tabId}"]`)
      ?.focus();
  });
}

function handleTabKeydown(event: KeyboardEvent, tabId: string): void {
  const currentIndex = tabs.value.findIndex((tab) => tab.id === tabId);
  if (currentIndex < 0) return;

  if (event.key === "Delete") {
    event.preventDefault();
    closeTab(tabId);
    return;
  }

  let targetIndex: number | undefined;
  if (event.key === "ArrowLeft")
    targetIndex = (currentIndex - 1 + tabs.value.length) % tabs.value.length;
  if (event.key === "ArrowRight") targetIndex = (currentIndex + 1) % tabs.value.length;
  if (event.key === "Home") targetIndex = 0;
  if (event.key === "End") targetIndex = tabs.value.length - 1;
  if (targetIndex === undefined) return;

  event.preventDefault();
  const targetTab = tabs.value[targetIndex];
  if (targetTab) activateTab(targetTab.id, true);
}

function resetTabs(): void {
  tabs.value = [];
  activeTabId.value = undefined;
}

watch(() => props.workspaceId, resetTabs);
</script>

<template>
  <aside
    :id="id"
    ref="sidebarRoot"
    class="flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-background"
    data-slot="chat-right-sidebar"
    :data-workspace-id="workspaceId"
    aria-label="右侧边栏"
  >
    <header class="drag-region mr-[46px] flex h-[44px] shrink-0 items-center gap-2 px-2 pt-[12px]">
      <div
        v-if="tabs.length > 0"
        class="no-drag-region flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none]"
        role="tablist"
        aria-label="右侧边栏标签页"
      >
        <div
          v-for="view in tabViews"
          :key="view.tab.id"
          class="flex h-[32px] max-w-52 min-w-32 shrink-0 items-center rounded-xl"
          :class="activeTabId === view.tab.id ? 'bg-muted' : 'hover:bg-muted/60'"
          data-slot="right-sidebar-tab"
          :data-tab-id="view.tab.id"
          :data-panel-kind="view.tab.kind"
        >
          <button
            type="button"
            class="flex h-full min-w-0 flex-1 items-center gap-2 rounded-l-xl px-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :id="`${view.tab.id}-activation`"
            :data-tab-activation="view.tab.id"
            role="tab"
            :aria-selected="activeTabId === view.tab.id"
            :aria-controls="`${view.tab.id}-panel`"
            :tabindex="activeTabId === view.tab.id ? 0 : -1"
            @click="activateTab(view.tab.id)"
            @keydown="handleTabKeydown($event, view.tab.id)"
          >
            <component :is="view.definition.icon" class="size-4 shrink-0" aria-hidden="true" />
            <span class="truncate font-medium">{{ view.title }}</span>
          </button>
          <button
            type="button"
            class="mr-1 flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-background/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :aria-label="`关闭 ${view.title}`"
            @click="closeTab(view.tab.id)"
          >
            <X class="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>
      <span v-else class="flex-1" />

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost"
            size="icon-sm"
            class="no-drag-region"
            aria-label="添加右侧栏标签页"
          >
            <Plus aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            v-for="definition in addMenuDefinitions"
            :key="definition.kind"
            @select="openPanel(definition.kind)"
          >
            <component :is="definition.icon" aria-hidden="true" />
            {{ definition.label }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>

    <div v-if="tabs.length === 0" class="flex min-h-0 flex-1 items-center justify-center p-5">
      <div class="grid w-full max-w-sm grid-cols-2 gap-3" data-slot="right-sidebar-empty-state">
        <button
          v-for="definition in emptyStateDefinitions"
          :key="definition.kind"
          type="button"
          class="flex aspect-square min-h-24 flex-col items-center justify-center gap-3 rounded-2xl border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          :data-panel-launcher="definition.kind"
          @click="openPanel(definition.kind)"
        >
          <component :is="definition.icon" class="size-7" aria-hidden="true" />
          <span class="text-sm font-medium">{{ definition.label }}</span>
        </button>
      </div>
    </div>

    <div v-else class="relative min-h-0 flex-1 overflow-hidden">
      <div
        v-for="view in tabViews"
        v-show="activeTabId === view.tab.id"
        :id="`${view.tab.id}-panel`"
        :key="view.tab.id"
        class="absolute inset-0 min-h-0 min-w-0 overflow-hidden"
        data-slot="right-sidebar-tab-panel"
        :data-tab-id="view.tab.id"
        :data-panel-kind="view.tab.kind"
        role="tabpanel"
        :aria-labelledby="`${view.tab.id}-activation`"
      >
        <component
          :is="view.definition.component"
          :workspace-id="workspaceId"
          :tab-id="view.tab.id"
          :state="view.tab.state"
          @select-skill="selectSkill"
          @update:state="updateTabState(view.tab.id, $event)"
        />
      </div>
    </div>
  </aside>
</template>
