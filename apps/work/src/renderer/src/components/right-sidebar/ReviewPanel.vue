<script setup lang="ts">
import { Button } from "@willow/shadcn/components/ui/button";
import { Input } from "@willow/shadcn/components/ui/input";
import {
  ChevronDown,
  ChevronRight,
  FileDiff,
  FolderOpen,
  GitBranch,
  MoreHorizontal,
  Search,
  SlidersHorizontal,
} from "lucide-vue-next";
import { computed } from "vue";
import type { ReviewPanelState } from "./types";

interface DemoChange {
  additions: number;
  deletions: number;
  id: string;
  name: string;
  path: string;
  lines: Array<{
    kind: "added" | "context" | "removed";
    newNumber?: number;
    oldNumber?: number;
    text: string;
  }>;
}

const props = defineProps<{
  workspaceId?: number;
  tabId: string;
  state: ReviewPanelState;
}>();

const emit = defineEmits<{
  "update:state": [state: ReviewPanelState];
}>();

const changes: DemoChange[] = [
  {
    additions: 2,
    deletions: 1,
    id: "right-sidebar",
    name: "RightSidebar.vue",
    path: "apps/work/src/renderer/src/components/right-sidebar/RightSidebar.vue",
    lines: [
      { kind: "context", oldNumber: 13, newNumber: 13, text: ':data-workspace-id="workspaceId"' },
      { kind: "context", oldNumber: 14, newNumber: 14, text: 'aria-label="右侧边栏"' },
      { kind: "removed", oldNumber: 16, text: "<div>右侧边栏区域demo</div>" },
      { kind: "added", newNumber: 16, text: "<div>审阅demo</div>" },
      { kind: "added", newNumber: 17, text: "<div>文件demo</div>" },
    ],
  },
  {
    additions: 8,
    deletions: 2,
    id: "sidebar-types",
    name: "types.ts",
    path: "apps/work/src/renderer/src/components/right-sidebar/types.ts",
    lines: [
      { kind: "added", newNumber: 1, text: "export interface RightSidebarPanelStateMap {" },
      { kind: "added", newNumber: 2, text: "  file: FilePanelState;" },
      { kind: "added", newNumber: 3, text: "  review: ReviewPanelState;" },
      { kind: "added", newNumber: 4, text: "}" },
    ],
  },
];

const selectedChange = computed(
  () => changes.find((change) => change.id === props.state.selectedChangeId) ?? changes[0],
);

function selectChange(change: DemoChange): void {
  emit("update:state", { selectedChangeId: change.id });
}
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col bg-background"
    data-slot="right-sidebar-review-panel"
    :data-tab-id="tabId"
    :data-workspace-id="workspaceId"
  >
    <div class="shrink-0 border-b px-3 py-2" data-slot="review-panel-toolbar">
      <div class="flex min-w-0 items-center gap-2">
        <Button variant="ghost" size="sm" disabled class="px-2">
          <GitBranch />
          分支
          <ChevronDown />
        </Button>
        <span class="text-sm font-medium text-emerald-600">+10</span>
        <span class="text-sm font-medium text-red-600">-3</span>
        <span class="flex-1" />
        <Button variant="ghost" size="icon-sm" disabled aria-label="更多审阅操作">
          <MoreHorizontal />
        </Button>
        <Button variant="ghost" size="icon-sm" disabled aria-label="审阅筛选">
          <SlidersHorizontal />
        </Button>
        <Button variant="secondary" size="sm" disabled>提交或推送</Button>
      </div>
      <div class="mt-1 flex items-center gap-2 px-1 text-sm text-muted-foreground">
        <span>main</span>
        <span aria-hidden="true">→</span>
        <span>origin/main</span>
        <ChevronDown class="size-4" aria-hidden="true" />
      </div>
    </div>

    <div class="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_minmax(9.5rem,1fr)]">
      <div class="min-h-0 min-w-0 overflow-auto border-r" data-slot="review-diff-preview">
        <div class="sticky top-0 z-10 flex min-h-11 items-center gap-2 border-b bg-background px-3">
          <FileDiff class="size-4 text-emerald-600" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium">{{
            selectedChange?.path
          }}</span>
          <span class="text-xs text-emerald-600">+{{ selectedChange?.additions }}</span>
          <span class="text-xs text-red-600">-{{ selectedChange?.deletions }}</span>
        </div>
        <div class="min-w-max py-2 font-mono text-xs">
          <div class="mb-1 bg-muted px-4 py-2 font-sans text-muted-foreground">
            12 unchanged lines
          </div>
          <div
            v-for="(line, index) in selectedChange?.lines"
            :key="`${selectedChange?.id}-${index}`"
            class="grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] leading-6"
            :class="{
              'bg-emerald-500/12': line.kind === 'added',
              'bg-red-500/12': line.kind === 'removed',
            }"
          >
            <span class="pr-2 text-right text-muted-foreground select-none">
              {{ line.oldNumber ?? "" }}
            </span>
            <span class="pr-2 text-right text-muted-foreground select-none">
              {{ line.newNumber ?? "" }}
            </span>
            <code class="pr-5 whitespace-pre">
              <span class="select-none">{{
                line.kind === "added" ? "+" : line.kind === "removed" ? "-" : " "
              }}</span>
              {{ line.text }}
            </code>
          </div>
        </div>
      </div>

      <aside class="min-h-0 min-w-0 overflow-auto px-2 py-3" aria-label="演示变更文件">
        <div class="relative mb-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input class="h-8 rounded-lg pl-8 text-xs" placeholder="筛选文件…" disabled />
        </div>
        <div class="mb-1 flex h-8 items-center gap-2 px-2 text-xs text-muted-foreground">
          <ChevronDown class="size-4" aria-hidden="true" />
          <FolderOpen class="size-4" aria-hidden="true" />
          <span class="truncate">willow / right-sidebar</span>
        </div>
        <div class="space-y-0.5" role="listbox" aria-label="变更文件">
          <button
            v-for="change in changes"
            :key="change.id"
            type="button"
            class="flex h-9 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            :class="{ 'bg-muted font-medium': selectedChange?.id === change.id }"
            :data-change-id="change.id"
            role="option"
            :aria-selected="selectedChange?.id === change.id"
            @click="selectChange(change)"
          >
            <ChevronRight class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <FileDiff class="size-4 shrink-0 text-emerald-600" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate">{{ change.name }}</span>
          </button>
        </div>
      </aside>
    </div>
  </section>
</template>
