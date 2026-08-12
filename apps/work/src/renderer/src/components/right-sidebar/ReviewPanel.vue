<script setup lang="ts">
import type {
  GitReviewArea,
  GitReviewChange,
  GitReviewDiff,
  GitReviewStatus,
  WorkspaceFilesChangedEvent,
} from "@shared/api";
import { WORKSPACE_FILES_CHANGED_EVENT } from "@shared/constants";
import { useDebounceFn } from "@vueuse/core";
import { Button } from "@willow/shadcn/components/ui/button";
import { Input } from "@willow/shadcn/components/ui/input";
import { TreeItem, TreeRoot, type TreeItemSelectEvent } from "@willow/shadcn/components/ui/tree";
import {
  Check,
  ChevronRight,
  CircleAlert,
  FileDiff,
  FileWarning,
  Folder,
  FolderOpen,
  GitBranch,
  GitCommitHorizontal,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
} from "lucide-vue-next";
import { resolveMaterialIcon } from "material-icon-resolver";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";
import { useDialog } from "@/components/dialog";
import { useEventBus } from "@/composables/useEventBus";
import { electronAPI } from "@/lib/ipc";
import GitCommitDialog from "./GitCommitDialog.vue";
import MonacoCodeViewer from "./MonacoCodeViewer.vue";
import type { ReviewPanelState } from "./types";

type ReviewTreeNode = ReviewGroupNode | ReviewFileNode;

interface ReviewGroupNode {
  area: GitReviewArea;
  children: ReviewTreeNode[];
  id: string;
  kind: "group";
  label: string;
}

interface ReviewFileNode {
  area: GitReviewArea;
  change: GitReviewChange;
  directory: string;
  id: string;
  kind: "file";
  name: string;
  path: string;
}

const REVIEW_BROWSER_WIDTH_STORAGE_KEY = "willow:review-panel-browser-width";
const REVIEW_BROWSER_WIDTH_EVENT = "willow:review-panel-browser-width-change";
const MIN_BROWSER_WIDTH = 176;
const RESIZE_HANDLE_WIDTH = 8;
const KEYBOARD_RESIZE_STEP = 16;

const props = defineProps<{
  workspaceId?: number;
  tabId: string;
  state: ReviewPanelState;
}>();

const emit = defineEmits<{
  "update:state": [state: ReviewPanelState];
}>();

const review = shallowRef<GitReviewStatus>();
const statusLoading = ref(false);
const statusError = ref("");
const actionError = ref("");
const actionLoading = ref(false);
const diff = shallowRef<GitReviewDiff>();
const diffLoading = ref(false);
const diffError = ref("");
const searchQuery = ref("");
const expandedNodes = shallowRef<string[]>(["group:staged", "group:unstaged"]);
const splitLayout = shallowRef<HTMLElement>();
const splitLayoutWidth = ref(0);
const preferredBrowserWidth = ref(loadSavedBrowserWidth());
const resizingBrowser = ref(false);
const showChangeList = ref(true);
const { addEventListener, removeEventListener, waitUntilReady } = useEventBus();
const { openDialog } = useDialog();

let disposed = false;
let statusGeneration = 0;
let diffGeneration = 0;
let resizeObserver: ResizeObserver | undefined;
let resizeStartPointerX = 0;
let resizeStartBrowserWidth = 0;
let previousBodyUserSelect = "";

const repositoryReview = computed(() => (review.value?.repository ? review.value : undefined));
const allChanges = computed(() => {
  const current = repositoryReview.value;
  return current ? [...current.staged, ...current.unstaged] : [];
});
const selectedChange = computed(() => {
  const selected = props.state.selectedChange;
  if (!selected) return undefined;
  return allChanges.value.find(
    (change) => change.path === selected.path && change.area === selected.area,
  );
});
const selectedTreeNode = computed<ReviewFileNode | undefined>(() => {
  const selected = selectedChange.value;
  return selected ? createFileNode(selected) : undefined;
});
const normalizedSearchQuery = computed(() => searchQuery.value.trim().toLocaleLowerCase());
const treeNodes = computed(() => {
  const current = repositoryReview.value;
  if (!current) return [];
  return [
    buildGroup("staged", "暂存的更改", current.staged, normalizedSearchQuery.value),
    buildGroup("unstaged", "更改", current.unstaged, normalizedSearchQuery.value),
  ].filter((group) => group.children.length > 0);
});
const stagedAdditions = computed(() => sumStats(repositoryReview.value?.staged ?? [], "additions"));
const stagedDeletions = computed(() => sumStats(repositoryReview.value?.staged ?? [], "deletions"));
const maximumBrowserWidth = computed(() =>
  Math.max(0, Math.floor((splitLayoutWidth.value - RESIZE_HANDLE_WIDTH) / 2)),
);
const minimumBrowserWidth = computed(() => Math.min(MIN_BROWSER_WIDTH, maximumBrowserWidth.value));
const browserWidth = computed(() => {
  const availableWidth = Math.max(0, splitLayoutWidth.value - RESIZE_HANDLE_WIDTH);
  const defaultWidth = Math.max(minimumBrowserWidth.value, Math.round(availableWidth / 3));
  return clampBrowserWidth(preferredBrowserWidth.value ?? defaultWidth);
});
const splitLayoutStyle = computed(() => {
  if (!showChangeList.value) return { gridTemplateColumns: "minmax(0, 1fr)" };
  if (splitLayoutWidth.value <= RESIZE_HANDLE_WIDTH) return undefined;
  const previewWidth = splitLayoutWidth.value - RESIZE_HANDLE_WIDTH - browserWidth.value;
  return {
    gridTemplateColumns: `${previewWidth}px ${RESIZE_HANDLE_WIDTH}px ${browserWidth.value}px`,
  };
});

function getChildren(node: ReviewTreeNode): ReviewTreeNode[] | undefined {
  return node.kind === "group" ? node.children : undefined;
}

function getKey(node: ReviewTreeNode): string {
  return node.id;
}

function buildGroup(
  area: GitReviewArea,
  label: string,
  changes: readonly GitReviewChange[],
  query: string,
): ReviewGroupNode {
  const visible = query
    ? changes.filter((change) => change.path.toLocaleLowerCase().includes(query))
    : changes;
  const root: ReviewGroupNode = {
    area,
    children: [],
    id: `group:${area}`,
    kind: "group",
    label,
  };
  root.children = visible.map(createFileNode);
  return root;
}

function createFileNode(change: GitReviewChange): ReviewFileNode {
  const segments = change.path.split("/").filter(Boolean);
  return {
    area: change.area,
    change,
    directory: segments.slice(0, -1).join("/"),
    id: `file:${change.area}:${change.path}`,
    kind: "file",
    name: change.path.split("/").at(-1) ?? change.path,
    path: change.path,
  };
}

function preventNonFileSelection(event: TreeItemSelectEvent<ReviewTreeNode>): void {
  if (event.detail.value?.kind !== "file") event.preventDefault();
}

function selectTreeNode(node?: ReviewTreeNode): void {
  if (node?.kind !== "file") return;
  emit("update:state", { selectedChange: { area: node.area, path: node.path } });
}

function iconForNode(node: ReviewTreeNode, expanded = false): string | undefined {
  if (node.kind === "group") return undefined;
  const icon = resolveMaterialIcon(node.name, {
    type: "file",
    open: expanded,
  });
  return icon?.cdnUrl;
}

function statusLabel(change: GitReviewChange): string {
  const labels = {
    added: "A",
    conflicted: "!",
    copied: "C",
    deleted: "D",
    modified: "M",
    renamed: "R",
    typeChanged: "T",
    untracked: "U",
  } as const;
  return labels[change.status];
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadStatus(): Promise<void> {
  const workspaceId = props.workspaceId;
  const generation = ++statusGeneration;
  diffGeneration += 1;
  diff.value = undefined;
  diffError.value = "";
  statusError.value = "";
  actionError.value = "";
  if (!workspaceId) {
    review.value = undefined;
    statusLoading.value = false;
    return;
  }
  statusLoading.value = true;
  try {
    const response = await electronAPI.getGitReviewStatus({ workspaceId });
    if (disposed || generation !== statusGeneration) return;
    review.value = response.review;
    ensureSelection(response.review);
  } catch (error) {
    if (disposed || generation !== statusGeneration) return;
    review.value = undefined;
    statusError.value = errorMessage(error, "无法读取 Git 状态");
  } finally {
    if (!disposed && generation === statusGeneration) statusLoading.value = false;
  }
}

function ensureSelection(status: GitReviewStatus): void {
  if (!status.repository) {
    if (props.state.selectedChange) emit("update:state", {});
    return;
  }
  const selected = props.state.selectedChange;
  const exists =
    selected &&
    [...status.staged, ...status.unstaged].some(
      (change) => change.area === selected.area && change.path === selected.path,
    );
  if (exists) return;
  const first = status.staged[0] ?? status.unstaged[0];
  emit("update:state", first ? { selectedChange: { area: first.area, path: first.path } } : {});
}

async function loadDiff(change: GitReviewChange | undefined): Promise<void> {
  const workspaceId = props.workspaceId;
  const generation = ++diffGeneration;
  diff.value = undefined;
  diffError.value = "";
  if (!workspaceId || !change) {
    diffLoading.value = false;
    return;
  }
  diffLoading.value = true;
  try {
    const response = await electronAPI.getGitReviewDiff({
      workspaceId,
      area: change.area,
      path: change.path,
      ...(change.oldPath ? { oldPath: change.oldPath } : {}),
    });
    if (!disposed && generation === diffGeneration) diff.value = response.diff;
  } catch (error) {
    if (!disposed && generation === diffGeneration) {
      diffError.value = errorMessage(error, "无法读取文件差异");
    }
  } finally {
    if (!disposed && generation === diffGeneration) diffLoading.value = false;
  }
}

async function updateIndex(area: GitReviewArea, paths?: string[]): Promise<void> {
  const workspaceId = props.workspaceId;
  if (!workspaceId || actionLoading.value) return;
  actionLoading.value = true;
  actionError.value = "";
  try {
    if (area === "unstaged") await electronAPI.stageGitChanges({ workspaceId, paths });
    else await electronAPI.unstageGitChanges({ workspaceId, paths });
    await loadStatus();
  } catch (error) {
    actionError.value = errorMessage(error, area === "unstaged" ? "暂存失败" : "取消暂存失败");
  } finally {
    actionLoading.value = false;
  }
}

function openCommitDialog(): void {
  const workspaceId = props.workspaceId;
  const current = repositoryReview.value;
  if (!workspaceId || !current || current.staged.length === 0) return;
  openDialog(
    GitCommitDialog,
    {
      workspaceId,
      stagedCount: current.staged.length,
      additions: stagedAdditions.value,
      deletions: stagedDeletions.value,
      onCommitted: () => void loadStatus(),
    },
    { contentClass: "sm:max-w-lg" },
  );
}

const scheduleFileRefresh = useDebounceFn(() => void loadStatus(), 150);

function handleWorkspaceFilesChanged(event: WorkspaceFilesChangedEvent): void {
  if (event.workspaceId === props.workspaceId && event.changes.length > 0) scheduleFileRefresh();
}

function handleWindowFocus(): void {
  void loadStatus();
}

function loadSavedBrowserWidth(): number | undefined {
  try {
    const value = Number(localStorage.getItem(REVIEW_BROWSER_WIDTH_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function clampBrowserWidth(width: number): number {
  return Math.max(minimumBrowserWidth.value, Math.min(width, maximumBrowserWidth.value));
}

function saveBrowserWidth(): void {
  const width = Math.round(browserWidth.value);
  preferredBrowserWidth.value = width;
  try {
    localStorage.setItem(REVIEW_BROWSER_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Persistence is optional when storage is unavailable.
  }
  window.dispatchEvent(new CustomEvent<number>(REVIEW_BROWSER_WIDTH_EVENT, { detail: width }));
}

function handleSharedBrowserWidth(event: Event): void {
  const width = (event as CustomEvent<number>).detail;
  if (Number.isFinite(width) && width > 0) preferredBrowserWidth.value = width;
}

function resizeBrowserFromPointer(event: PointerEvent): void {
  preferredBrowserWidth.value = clampBrowserWidth(
    resizeStartBrowserWidth - (event.clientX - resizeStartPointerX),
  );
}

function stopBrowserResize(): void {
  if (!resizingBrowser.value) return;
  resizingBrowser.value = false;
  saveBrowserWidth();
  window.removeEventListener("pointermove", resizeBrowserFromPointer);
  window.removeEventListener("pointerup", stopBrowserResize);
  window.removeEventListener("pointercancel", stopBrowserResize);
  document.body.style.userSelect = previousBodyUserSelect;
}

function startBrowserResize(event: PointerEvent): void {
  if (event.button !== 0 || resizingBrowser.value) return;
  event.preventDefault();
  previousBodyUserSelect = document.body.style.userSelect;
  document.body.style.userSelect = "none";
  resizeStartPointerX = event.clientX;
  resizeStartBrowserWidth = browserWidth.value;
  resizingBrowser.value = true;
  window.addEventListener("pointermove", resizeBrowserFromPointer);
  window.addEventListener("pointerup", stopBrowserResize);
  window.addEventListener("pointercancel", stopBrowserResize);
}

function handleResizeKeydown(event: KeyboardEvent): void {
  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
  event.preventDefault();
  preferredBrowserWidth.value = clampBrowserWidth(
    browserWidth.value + (event.key === "ArrowLeft" ? KEYBOARD_RESIZE_STEP : -KEYBOARD_RESIZE_STEP),
  );
  saveBrowserWidth();
}

function sumStats(changes: readonly GitReviewChange[], key: "additions" | "deletions"): number {
  return changes.reduce((total, change) => total + (change[key] ?? 0), 0);
}

addEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
watch(
  () => props.workspaceId,
  () => void loadStatus(),
  { immediate: true },
);
watch(selectedChange, (change) => void loadDiff(change), { immediate: true });
watch(
  splitLayout,
  (layout) => {
    resizeObserver?.disconnect();
    resizeObserver = undefined;
    if (!layout) {
      splitLayoutWidth.value = 0;
      return;
    }
    splitLayoutWidth.value = layout.getBoundingClientRect().width;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width;
        if (width !== undefined) splitLayoutWidth.value = width;
      });
      resizeObserver.observe(layout);
    }
  },
  { flush: "post" },
);

onMounted(() => {
  window.addEventListener("focus", handleWindowFocus);
  window.addEventListener(REVIEW_BROWSER_WIDTH_EVENT, handleSharedBrowserWidth);
  void waitUntilReady().catch((error) => console.error("订阅工作区文件事件失败:", error));
});

onBeforeUnmount(() => {
  disposed = true;
  statusGeneration += 1;
  diffGeneration += 1;
  resizeObserver?.disconnect();
  stopBrowserResize();
  removeEventListener(WORKSPACE_FILES_CHANGED_EVENT, handleWorkspaceFilesChanged);
  window.removeEventListener("focus", handleWindowFocus);
  window.removeEventListener(REVIEW_BROWSER_WIDTH_EVENT, handleSharedBrowserWidth);
});
</script>

<template>
  <section
    class="flex h-full min-h-0 min-w-0 flex-col bg-background"
    data-slot="right-sidebar-review-panel"
    :data-tab-id="tabId"
    :data-workspace-id="workspaceId"
  >
    <div
      class="flex min-h-12 shrink-0 items-center gap-2 border-b px-3"
      data-slot="review-panel-toolbar"
    >
      <GitBranch class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span class="truncate text-sm font-medium">{{ repositoryReview?.branch ?? "Git 审阅" }}</span>
      <template v-if="repositoryReview?.upstream">
        <span class="text-xs text-muted-foreground">→ {{ repositoryReview.upstream }}</span>
        <span v-if="repositoryReview.ahead" class="text-xs text-muted-foreground"
          >↑{{ repositoryReview.ahead }}</span
        >
        <span v-if="repositoryReview.behind" class="text-xs text-muted-foreground"
          >↓{{ repositoryReview.behind }}</span
        >
      </template>
      <span class="ml-1 text-xs font-medium text-emerald-600"
        >+{{ repositoryReview?.additions ?? 0 }}</span
      >
      <span class="text-xs font-medium text-red-600">-{{ repositoryReview?.deletions ?? 0 }}</span>
      <span class="flex-1" />
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="刷新 Git 状态"
        :disabled="statusLoading || actionLoading || !workspaceId"
        @click="loadStatus"
      >
        <RefreshCw :class="{ 'animate-spin': statusLoading }" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        :aria-label="showChangeList ? '隐藏变更列表' : '显示变更列表'"
        :aria-expanded="showChangeList"
        :pressed="showChangeList"
        @click="showChangeList = !showChangeList"
      >
        <FolderOpen v-show="showChangeList" aria-hidden="true" />
        <Folder v-show="!showChangeList" aria-hidden="true" />
      </Button>
      <Button
        size="sm"
        :disabled="!repositoryReview?.staged.length || actionLoading"
        @click="openCommitDialog"
      >
        <GitCommitHorizontal aria-hidden="true" />
        提交
      </Button>
    </div>

    <div
      v-if="statusLoading && !review"
      class="flex min-h-0 flex-1 items-center justify-center gap-2 text-sm text-muted-foreground"
    >
      <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
      正在读取 Git 状态…
    </div>
    <div
      v-else-if="statusError"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-5 text-center"
      role="alert"
    >
      <CircleAlert class="size-9 text-destructive" aria-hidden="true" />
      <p class="text-sm text-destructive">{{ statusError }}</p>
      <Button size="sm" variant="outline" @click="loadStatus">重试</Button>
    </div>
    <div
      v-else-if="review && !review.repository"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 text-center"
    >
      <GitBranch class="size-10 text-muted-foreground" aria-hidden="true" />
      <p class="font-medium">当前工作区不是 Git 仓库</p>
      <p class="text-sm text-muted-foreground">请打开已初始化 Git 的工作区</p>
    </div>
    <div
      v-else-if="repositoryReview && allChanges.length === 0"
      class="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 px-5 text-center"
    >
      <Check class="size-10 text-emerald-500" aria-hidden="true" />
      <p class="font-medium">工作区没有变更</p>
      <p class="text-sm text-muted-foreground">所有文件均已提交</p>
    </div>

    <div
      v-else-if="repositoryReview"
      ref="splitLayout"
      class="grid min-h-0 flex-1 grid-cols-[minmax(0,2fr)_8px_minmax(11rem,1fr)]"
      :style="splitLayoutStyle"
      data-slot="review-panel-split-layout"
    >
      <div :id="`${tabId}-review-preview-region`" class="min-h-0 min-w-0">
        <div
          v-if="!selectedChange"
          class="flex h-full items-center justify-center text-sm text-muted-foreground"
        >
          从变更树中选择文件
        </div>
        <div
          v-else-if="diffLoading"
          class="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground"
        >
          <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
          正在生成差异…
        </div>
        <div
          v-else-if="diffError"
          class="flex h-full flex-col items-center justify-center gap-3 px-5 text-center"
          role="alert"
        >
          <FileWarning class="size-9 text-destructive" aria-hidden="true" />
          <p class="text-sm text-destructive">{{ diffError }}</p>
          <Button size="sm" variant="outline" @click="loadDiff(selectedChange)">重试</Button>
        </div>
        <div
          v-else-if="diff?.binary"
          class="flex h-full flex-col items-center justify-center gap-2 px-5 text-center"
        >
          <FileWarning class="size-9 text-muted-foreground" aria-hidden="true" />
          <p class="font-medium">二进制文件无法预览差异</p>
          <p class="text-sm text-muted-foreground">{{ selectedChange.path }}</p>
        </div>
        <div v-else-if="diff" class="flex h-full min-h-0 flex-col" data-slot="review-diff-preview">
          <div
            class="flex min-h-10 shrink-0 items-center gap-2 border-b px-3 text-xs text-muted-foreground"
          >
            <FileDiff class="size-4" aria-hidden="true" />
            <span class="min-w-0 flex-1 truncate" :title="selectedChange.path">{{
              selectedChange.path
            }}</span>
            <span>{{ selectedChange.area === "staged" ? "已暂存" : "未暂存" }}</span>
          </div>
          <p
            v-if="diff.truncated"
            class="shrink-0 border-b bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400"
          >
            差异过大，仅显示前 {{ Math.round((4 * 1024 * 1024) / 1024 / 1024) }} MiB
          </p>
          <MonacoCodeViewer
            class="min-h-0 flex-1"
            :aria-label="`${selectedChange.path} Git 差异`"
            :code="diff.content"
            language="plaintext"
            variant="diff"
          />
        </div>
      </div>

      <div
        v-show="showChangeList"
        class="relative z-10 cursor-col-resize touch-none outline-none after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border hover:after:bg-ring focus-visible:after:w-0.5 focus-visible:after:bg-ring"
        :class="{ 'after:bg-ring': resizingBrowser }"
        data-slot="review-panel-resize-handle"
        role="separator"
        aria-label="调整变更列表宽度"
        aria-orientation="vertical"
        :aria-valuemin="minimumBrowserWidth"
        :aria-valuemax="maximumBrowserWidth"
        :aria-valuenow="browserWidth"
        tabindex="0"
        @pointerdown="startBrowserResize"
        @keydown="handleResizeKeydown"
      />

      <aside
        v-show="showChangeList"
        :id="`${tabId}-review-tree-region`"
        class="min-h-0 min-w-0 overflow-auto px-2 py-3"
        aria-label="Git 变更文件"
        data-slot="review-panel-browser"
      >
        <div class="relative mb-2">
          <Search
            class="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            v-model="searchQuery"
            class="h-8 rounded-lg pl-8 text-xs"
            placeholder="筛选变更…"
          />
        </div>
        <p v-if="actionError" class="mb-2 px-2 text-xs text-destructive" role="alert">
          {{ actionError }}
        </p>
        <p
          v-if="normalizedSearchQuery && treeNodes.length === 0"
          class="px-2 py-3 text-xs text-muted-foreground"
        >
          没有匹配的变更
        </p>
        <TreeRoot
          v-else
          v-slot="{ flattenItems }"
          :items="treeNodes"
          :model-value="selectedTreeNode"
          :expanded="expandedNodes"
          :get-key="getKey"
          :get-children="getChildren"
          selection-behavior="replace"
          as="div"
          class="space-y-0.5 outline-none"
          aria-label="Git 变更树"
          data-slot="review-tree"
          @update:expanded="expandedNodes = $event"
          @update:model-value="selectTreeNode"
        >
          <TreeItem
            v-for="item in flattenItems"
            :key="item._id"
            v-bind="item.bind"
            v-slot="{ isExpanded }"
            as="button"
            type="button"
            class="group flex min-h-8 w-full items-center gap-1.5 rounded-md pr-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[selected]:bg-muted"
            :style="{ paddingInlineStart: `${(item.level - 1) * 16 + 8}px` }"
            :data-node-kind="item.value.kind"
            :data-node-id="item.value.id"
            @select="preventNonFileSelection"
          >
            <ChevronRight
              v-if="item.hasChildren"
              class="size-4 shrink-0 text-muted-foreground transition-transform"
              :class="{ 'rotate-90': isExpanded }"
              aria-hidden="true"
            />
            <span v-else class="size-4 shrink-0" />
            <img
              v-if="iconForNode(item.value, isExpanded)"
              :src="iconForNode(item.value, isExpanded)"
              class="size-4 shrink-0"
              alt=""
            />
            <template v-if="item.value.kind === 'group'">
              <span class="min-w-0 flex-1 truncate font-medium">{{ item.value.label }}</span>
              <span
                class="min-w-6 shrink-0 rounded-full bg-primary/15 px-1.5 py-0.5 text-center text-[10px] font-medium text-primary"
              >
                {{ item.value.children.length }}
              </span>
            </template>
            <template v-if="item.value.kind === 'file'">
              <span
                class="max-w-[45%] min-w-0 shrink truncate font-medium"
                :title="item.value.name"
              >
                {{ item.value.name }}
              </span>
              <span
                v-if="item.value.directory"
                class="min-w-0 flex-1 truncate text-muted-foreground"
                :title="item.value.directory"
              >
                {{ item.value.directory }}
              </span>
              <span v-else class="flex-1" />
              <span class="shrink-0 font-mono text-[10px] text-muted-foreground">{{
                statusLabel(item.value.change)
              }}</span>
              <span
                v-if="item.value.change.additions !== undefined"
                class="shrink-0 text-[10px] text-emerald-600"
                >+{{ item.value.change.additions }}</span
              >
              <span
                v-if="item.value.change.deletions !== undefined"
                class="shrink-0 text-[10px] text-red-600"
                >-{{ item.value.change.deletions }}</span
              >
              <Button
                variant="ghost"
                size="icon-sm"
                class="opacity-0 group-focus-within:opacity-100 group-hover:opacity-100"
                :aria-label="
                  item.value.area === 'unstaged'
                    ? `暂存 ${item.value.path}`
                    : `取消暂存 ${item.value.path}`
                "
                :disabled="actionLoading"
                @click.stop="updateIndex(item.value.area, [item.value.path])"
              >
                <Plus v-if="item.value.area === 'unstaged'" aria-hidden="true" />
                <Minus v-else aria-hidden="true" />
              </Button>
            </template>
            <Button
              v-else-if="item.value.kind === 'group'"
              variant="ghost"
              size="icon-sm"
              :aria-label="item.value.area === 'unstaged' ? '暂存全部变更' : '取消暂存全部变更'"
              :disabled="actionLoading"
              @click.stop="updateIndex(item.value.area)"
            >
              <Plus v-if="item.value.area === 'unstaged'" aria-hidden="true" />
              <Minus v-else aria-hidden="true" />
            </Button>
          </TreeItem>
        </TreeRoot>
      </aside>
    </div>
  </section>
</template>
