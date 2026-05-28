<script setup lang="ts">
import type { Session, TodoItem, Workspace } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@willow/shadcn/components/ui/navigation-menu";
import { Progress } from "@willow/shadcn/components/ui/progress";
import { ScrollArea } from "@willow/shadcn/components/ui/scroll-area";
import { Separator } from "@willow/shadcn/components/ui/separator";
import { Sidebar } from "@willow/shadcn/components/ui/sidebar";
import { Textarea } from "@willow/shadcn/components/ui/textarea";
import {
  CheckCircle2Icon,
  CircleIcon,
  FolderOpen,
  FileText,
  FolderOpenIcon,
  InfoIcon,
  LoaderIcon,
  Save,
  Settings2Icon,
  XCircleIcon,
  Plus,
  Pencil,
  Trash2,
  RotateCw,
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch, provide } from "vue";
import { useWorkspaceFiles } from "@/composables/useWorkspaceFiles";
import { useWorkspaceSettings } from "@/composables/useWorkspaceSettings";
import { DeleteMcpServer } from "@/layout/dialog/delete-mcp-server";
import { McpServerForm } from "@/layout/dialog/mcp-server-form";
import { electronAPI } from "@/lib/ipc";
import InlineFileViewer from "@/pages/chat/session/components/InlineFileViewer.vue";
import WorkspaceFileTree from "@/pages/chat/session/components/WorkspaceFileTree.vue";
import { useMcpStore } from "@/stores/mcp";
import { useWorkspaceStore } from "@/stores/workspace";

const props = withDefaults(
  defineProps<{
    mode: "workspace" | "session";
    open: boolean;
    width: number;
    isDragging?: boolean;
    session?: Session;
    workspace?: Workspace;
    messageCount?: number;
    todos?: TodoItem[];
  }>(),
  {
    width: 320,
    isDragging: false,
    messageCount: 0,
    todos: () => [],
  },
);

const workspaceStore = useWorkspaceStore();
const sidebarStyle = computed(() => ({
  width: props.open
    ? `clamp(240px, calc(${props.width}px + var(--left-sidebar-released-width, 0px)), calc(100% - 350px - 4px))`
    : "0px",
  flexBasis: props.open
    ? `clamp(240px, calc(${props.width}px + var(--left-sidebar-released-width, 0px)), calc(100% - 350px - 4px))`
    : "0px",
}));
const workspaceId = computed(() => props.workspace?.id ?? props.session?.workspaceId ?? 0);
const stableWorkspaceId = ref(workspaceId.value);
watch(
  workspaceId,
  (newId) => {
    if (newId && newId !== 0) {
      stableWorkspaceId.value = newId;
    }
  },
  { immediate: true },
);

const activeTab = ref<"files" | "app">("files");
const {
  files,
  rootPath,
  isLoading: isFilesLoading,
  errorMessage: filesErrorMessage,
  refresh: refreshFiles,
} = useWorkspaceFiles(stableWorkspaceId);
const {
  workspacePath,
  soulContent,
  isSaving,
  errorMessage: settingsErrorMessage,
  saveMessage,
  saveSettings,
} = useWorkspaceSettings(stableWorkspaceId);

const mcpStore = useMcpStore();
const { workspaceServers } = storeToRefs(mcpStore);

watch(
  stableWorkspaceId,
  (newId) => {
    if (newId && props.mode === "workspace") {
      mcpStore.fetchWorkspaceServers(newId);
    }
  },
  { immediate: true },
);

const completedCount = computed(
  () => props.todos.filter((todo) => todo.status === "completed").length,
);

const totalCount = computed(() => props.todos.length);
const progress = computed(() => {
  if (!totalCount.value) {
    return 0;
  }
  return (completedCount.value / totalCount.value) * 100;
});
const totalFileCount = computed(() => countFiles(files.value));

const statusConfig = {
  completed: { icon: CheckCircle2Icon, className: "text-emerald-500" },
  in_progress: { icon: LoaderIcon, className: "text-blue-500 animate-spin" },
  pending: { icon: CircleIcon, className: "text-muted-foreground/60" },
  cancelled: { icon: XCircleIcon, className: "text-destructive/60" },
} as const;

watch(
  () => props.mode,
  () => {
    activeTab.value = "files";
  },
);

function countFiles(items: typeof files.value): number {
  return items.reduce((count, item) => {
    if (item.type === "folder" && item.children) {
      return count + countFiles(item.children);
    }
    return count + (item.type === "file" ? 1 : 0);
  }, 0);
}

async function handleSaveWorkspaceSettings() {
  await saveSettings();
  await workspaceStore.fetchWorkspaceList();
}

async function handleOpenWorkspaceFolder() {
  const path = rootPath.value || props.workspace?.path || workspacePath.value;
  if (!path) {
    return;
  }

  await electronAPI.openPath({ path });
}

// AI 应用视图 — WebContentsView 绑定
const viewAnchor = ref<HTMLElement | null>(null);
const isAppVisible = ref(false);
let resizeObserver: ResizeObserver | null = null;
let lastBounds: { x: number; y: number; width: number; height: number } | null = null;

function sameBounds(bounds: { x: number; y: number; width: number; height: number }) {
  return (
    lastBounds?.x === bounds.x &&
    lastBounds.y === bounds.y &&
    lastBounds.width === bounds.width &&
    lastBounds.height === bounds.height
  );
}

function sendBounds() {
  if (!viewAnchor.value) return;
  const rect = viewAnchor.value.getBoundingClientRect();
  const bounds = {
    x: Math.round(rect.x),
    y: Math.round(rect.y),
    width: Math.round(rect.width),
    height: Math.round(rect.height),
  };
  if (sameBounds(bounds)) return;
  lastBounds = bounds;
  electronAPI.updateAiAppBounds(bounds);
}

async function sendBoundsAfterLayout() {
  await nextTick();
  requestAnimationFrame(() => {
    sendBounds();
  });
}

async function showApp() {
  if (!workspacePath.value) return;
  await nextTick();
  if (viewAnchor.value) {
    resizeObserver?.observe(viewAnchor.value);
  }
  await electronAPI.loadAiApp({ workspaceRoot: workspacePath.value });
  // 等待 sidebar transition (300ms) 完成后再发送 bounds
  await new Promise((resolve) => setTimeout(resolve, 350));
  sendBounds();
  isAppVisible.value = true;
}

async function hideApp() {
  resizeObserver?.disconnect();
  await electronAPI.closeAiApp();
  isAppVisible.value = false;
  lastBounds = null;
}

onMounted(() => {
  resizeObserver = new ResizeObserver(() => {
    sendBounds();
  });
});

watch([activeTab, () => props.open], async ([newTab, isOpen]) => {
  const shouldShow = newTab === "app" && isOpen;
  if (shouldShow) {
    await showApp();
  } else if (isAppVisible.value) {
    await hideApp();
  }
});

// 切换工作空间时，主进程根据 rootChanged 自动决定是否重新加载
watch(workspacePath, async (newPath, oldPath) => {
  if (isAppVisible.value && newPath !== oldPath) {
    await electronAPI.loadAiApp({ workspaceRoot: newPath! });
    await new Promise((resolve) => setTimeout(resolve, 350));
    sendBounds();
  }
});

watch(
  () => [props.width, props.open, props.isDragging] as const,
  async () => {
    if (isAppVisible.value) {
      await sendBoundsAfterLayout();
    }
  },
);

const selectedFilePath = ref<string | null>(null);
const selectedFileName = ref<string | null>(null);

provide("selectFile", (path: string, name: string) => {
  selectedFilePath.value = path;
  selectedFileName.value = name;
});

watch([stableWorkspaceId, activeTab], () => {
  selectedFilePath.value = null;
  selectedFileName.value = null;
});

const isAppLoading = ref(false);
async function refreshApp() {
  if (!workspacePath.value) return;
  try {
    isAppLoading.value = true;
    await electronAPI.loadAiApp({ workspaceRoot: workspacePath.value });
    sendBounds();
  } catch (err) {
    console.error("Failed to reload AI app", err);
  } finally {
    isAppLoading.value = false;
  }
}

onUnmounted(() => {
  resizeObserver?.disconnect();
  if (isAppVisible.value) {
    electronAPI.closeAiApp();
  }
});
</script>

<template>
  <aside
    class="min-h-0 flex-none overflow-hidden"
    :class="{ 'transition-[width,flex-basis] duration-200 ease-linear': !props.isDragging }"
    :style="sidebarStyle"
  >
    <Sidebar
      side="right"
      collapsible="none"
      class="h-full bg-card"
      :style="{
        width: props.open ? '100%' : '0px',
        '--sidebar-width': props.open ? '100%' : '0rem',
      }"
    >
      <div class="flex h-full flex-col">
        <div class="drag-region flex items-center border-b border-sidebar-border px-3 py-2">
          <NavigationMenu orientation="horizontal" class="no-drag-region w-fit">
            <NavigationMenuList class="flex-wrap justify-start">
              <NavigationMenuItem>
                <NavigationMenuLink as-child :active="activeTab === 'files'">
                  <button type="button" class="h-8" @click="activeTab = 'files'">
                    <FolderOpenIcon class="size-3.5" />
                    文件
                    <span
                      class="group/refresh relative inline-flex h-5 min-w-[20px] cursor-pointer items-center justify-center rounded bg-background px-1 text-[10px] text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="刷新文件"
                      @click.stop="!isFilesLoading && refreshFiles()"
                    >
                      <span
                        class="transition-opacity duration-150"
                        :class="{ 'opacity-0': isFilesLoading }"
                      >
                        <span class="transition-opacity duration-150 group-hover/refresh:opacity-0">
                          {{ totalFileCount }}
                        </span>
                      </span>
                      <span
                        class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-150"
                        :class="{
                          'opacity-100': isFilesLoading,
                          'group-hover/refresh:opacity-100': !isFilesLoading,
                        }"
                      >
                        <RotateCw class="size-3" :class="{ 'animate-spin': isFilesLoading }" />
                      </span>
                    </span>
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink as-child :active="activeTab === 'app'">
                  <button type="button" class="h-8" @click="activeTab = 'app'">
                    <FileText class="size-3.5" />
                    应用
                    <span
                      class="group/refresh relative ml-1 inline-flex h-5 w-5 cursor-pointer items-center justify-center rounded bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                      title="刷新应用"
                      @click.stop="refreshApp"
                    >
                      <RotateCw class="size-3" :class="{ 'animate-spin': isAppLoading }" />
                    </span>
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <div
          v-if="activeTab === 'files'"
          class="flex min-h-0 w-full flex-1 divide-x divide-sidebar-border"
        >
          <div class="flex h-full w-[200px] flex-shrink-0 flex-col border-r border-sidebar-border">
            <div class="flex h-full flex-col space-y-3 p-3">
              <div class="space-y-1">
                <div class="text-xs font-medium text-muted-foreground">工作空间文件</div>
                <div class="flex items-center gap-2">
                  <div class="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                    {{ rootPath || props.workspace?.path || "未找到工作空间路径" }}
                  </div>
                  <Button
                    v-if="rootPath || props.workspace?.path || workspacePath"
                    type="button"
                    variant="ghost"
                    size="icon"
                    class="h-7 w-7 shrink-0"
                    title="打开当前工作空间文件夹"
                    @click="handleOpenWorkspaceFolder"
                  >
                    <FolderOpen class="size-4" />
                  </Button>
                </div>
              </div>

              <div
                v-if="isFilesLoading"
                class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground"
              >
                正在读取文件列表...
              </div>
              <div
                v-else-if="filesErrorMessage"
                class="rounded-lg border border-dashed border-destructive/30 px-3 py-6 text-center text-sm text-muted-foreground"
              >
                {{ filesErrorMessage }}
              </div>
              <div
                v-else-if="files.length === 0"
                class="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground"
              >
                当前工作空间没有可展示的文件
              </div>
              <ScrollArea class="min-h-0 flex-1" v-else>
                <WorkspaceFileTree :items="files" :workspace-id="stableWorkspaceId" />
              </ScrollArea>
            </div>
          </div>

          <div class="h-full min-h-0 min-w-0 flex-1 bg-background">
            <InlineFileViewer
              :workspace-id="stableWorkspaceId"
              :file-path="selectedFilePath"
              :file-name="selectedFileName"
            />
          </div>
        </div>

        <div
          v-else-if="activeTab === 'app'"
          ref="viewAnchor"
          class="ai-app-anchor min-h-0 w-full flex-1"
        />
      </div>
    </Sidebar>
  </aside>
</template>
