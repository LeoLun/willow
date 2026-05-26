<script setup lang="ts">
import type { Session, TodoItem, Workspace } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import { Label } from "@willow/shadcn/components/ui/label";
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
} from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { computed, nextTick, onMounted, onUnmounted, ref, toRef, watch } from "vue";
import { useWorkspaceFiles } from "@/composables/useWorkspaceFiles";
import { useWorkspaceSettings } from "@/composables/useWorkspaceSettings";
import { DeleteMcpServer } from "@/layout/dialog/delete-mcp-server";
import { McpServerForm } from "@/layout/dialog/mcp-server-form";
import { electronAPI } from "@/lib/ipc";
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
const activeTab = ref<"primary" | "files" | "app">(
  props.mode === "workspace" ? "primary" : "primary",
);
const {
  files,
  rootPath,
  isLoading: isFilesLoading,
  errorMessage: filesErrorMessage,
} = useWorkspaceFiles(workspaceId);
const {
  workspacePath,
  soulContent,
  isSaving,
  errorMessage: settingsErrorMessage,
  saveMessage,
  saveSettings,
} = useWorkspaceSettings(toRef(workspaceId));

const mcpStore = useMcpStore();
const { workspaceServers } = storeToRefs(mcpStore);

watch(
  workspaceId,
  (newId) => {
    if (newId && props.mode === "workspace") {
      mcpStore.fetchWorkspaceServers(newId);
    }
  },
  { immediate: true },
);

function handleAddWorkspaceMcp() {
  openDialog(McpServerForm, {
    workspaceId: workspaceId.value,
    onSaved: () => mcpStore.fetchWorkspaceServers(workspaceId.value),
  });
}

function handleEditWorkspaceMcp(server: any) {
  openDialog(McpServerForm, {
    mcpServer: server,
    workspaceId: workspaceId.value,
    onSaved: () => mcpStore.fetchWorkspaceServers(workspaceId.value),
  });
}

function handleDeleteWorkspaceMcp(server: any) {
  openDialog(DeleteMcpServer, {
    mcpServer: server,
    workspaceId: workspaceId.value,
    onDeleted: () => mcpStore.fetchWorkspaceServers(workspaceId.value),
  });
}

async function handleToggleWorkspaceMcp(server: any) {
  await mcpStore.toggleServer(workspaceId.value, server.name, !server.disabled);
}

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
const formattedCreatedAt = computed(() => {
  if (!props.session?.createdAt) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(props.session.createdAt));
});
const formattedUpdatedAt = computed(() => {
  if (!props.session?.lastActiveAt) {
    return "--";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(props.session.lastActiveAt));
});
const totalFileCount = computed(() => countFiles(files.value));
const primaryTabLabel = computed(() => (props.mode === "workspace" ? "设置" : "概要"));
const primaryTabIcon = computed(() => (props.mode === "workspace" ? Settings2Icon : InfoIcon));

const statusConfig = {
  completed: { icon: CheckCircle2Icon, className: "text-emerald-500" },
  in_progress: { icon: LoaderIcon, className: "text-blue-500 animate-spin" },
  pending: { icon: CircleIcon, className: "text-muted-foreground/60" },
  cancelled: { icon: XCircleIcon, className: "text-destructive/60" },
} as const;

watch(
  () => props.mode,
  () => {
    activeTab.value = "primary";
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
        <div class="border-b border-sidebar-border px-3 py-2">
          <NavigationMenu orientation="horizontal" class="max-w-full">
            <NavigationMenuList class="flex-wrap justify-start">
              <NavigationMenuItem>
                <NavigationMenuLink as-child :active="activeTab === 'primary'">
                  <button type="button" class="h-8" @click="activeTab = 'primary'">
                    <component :is="primaryTabIcon" class="size-3.5" />
                    {{ primaryTabLabel }}
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink as-child :active="activeTab === 'files'">
                  <button type="button" class="h-8" @click="activeTab = 'files'">
                    <FolderOpenIcon class="size-3.5" />
                    文件
                    <span
                      class="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground"
                    >
                      {{ totalFileCount }}
                    </span>
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>

              <NavigationMenuItem>
                <NavigationMenuLink as-child :active="activeTab === 'app'">
                  <button type="button" class="h-8" @click="activeTab = 'app'">
                    <FileText class="size-3.5" />
                    应用
                  </button>
                </NavigationMenuLink>
              </NavigationMenuItem>
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        <ScrollArea v-if="activeTab === 'primary'" class="h-full">
          <div v-if="props.mode === 'workspace'" class="space-y-6 p-4">
            <div class="space-y-2">
              <h4 class="text-xs font-medium text-muted-foreground">工作空间信息</h4>
              <div class="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">名称</span>
                  <span class="truncate text-right">{{
                    props.workspace?.name || "未命名工作空间"
                  }}</span>
                </div>
              </div>
            </div>

            <Separator />

            <div class="space-y-3">
              <div class="flex items-center justify-between gap-4">
                <h4 class="text-xs font-medium text-muted-foreground">MCP 服务 (工作空间)</h4>
                <Button
                  size="xs"
                  variant="ghost"
                  class="h-6 gap-1 px-1.5 text-[10px]"
                  @click="handleAddWorkspaceMcp"
                >
                  <Plus class="size-3" />
                  添加
                </Button>
              </div>

              <div
                v-if="workspaceServers.length === 0"
                class="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground"
              >
                暂无配置的工作空间 MCP 服务
              </div>

              <div v-else class="space-y-2">
                <div
                  v-for="server in workspaceServers"
                  :key="server.name"
                  class="group/item flex items-center justify-between gap-3 rounded-lg border bg-muted/30 p-2 text-xs transition-colors hover:bg-muted/50"
                >
                  <div class="min-w-0 flex-1 space-y-0.5">
                    <div class="flex items-center gap-1.5">
                      <span class="truncate font-mono font-medium">{{ server.name }}</span>
                      <span
                        class="rounded border bg-background px-1 py-0.5 text-[9px] text-muted-foreground"
                        >{{ server.type }}</span
                      >
                    </div>
                    <p class="truncate text-[10px] text-muted-foreground">
                      {{ server.type === "stdio" ? server.command : server.url }}
                    </p>
                  </div>

                  <div class="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      class="text-[10px] text-muted-foreground hover:text-foreground"
                      @click="handleToggleWorkspaceMcp(server)"
                    >
                      {{ server.disabled ? "启用" : "禁用" }}
                    </button>
                    <div
                      class="flex items-center gap-0.5 opacity-0 transition-opacity group-hover/item:opacity-100"
                    >
                      <button
                        type="button"
                        class="p-1 text-muted-foreground hover:text-foreground"
                        @click="handleEditWorkspaceMcp(server)"
                      >
                        <Pencil class="size-3" />
                      </button>
                      <button
                        type="button"
                        class="p-1 text-destructive/80 hover:text-destructive"
                        @click="handleDeleteWorkspaceMcp(server)"
                      >
                        <Trash2 class="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div v-else class="space-y-4 p-3">
            <div class="space-y-2">
              <h4 class="text-xs font-medium text-muted-foreground">会话信息</h4>
              <div class="space-y-1.5 rounded-lg bg-muted/50 p-3 text-sm">
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">标题</span>
                  <span class="truncate text-right">{{
                    props.session?.title || "未命名会话"
                  }}</span>
                </div>
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">创建时间</span>
                  <span class="text-right">{{ formattedCreatedAt }}</span>
                </div>
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">最近活跃</span>
                  <span class="text-right">{{ formattedUpdatedAt }}</span>
                </div>
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">消息数量</span>
                  <span class="text-right">{{ props.messageCount }} 条</span>
                </div>
                <div class="flex justify-between gap-3">
                  <span class="text-muted-foreground">工作空间</span>
                  <span class="truncate text-right">{{ props.workspace?.name || "--" }}</span>
                </div>
              </div>
            </div>

            <div v-if="props.todos.length > 0" class="space-y-2">
              <Separator />
              <h4 class="text-xs font-medium text-muted-foreground">
                任务进度 ({{ completedCount }}/{{ totalCount }})
              </h4>
              <div class="space-y-2 rounded-lg bg-muted/50 p-3">
                <div class="flex items-center justify-between text-xs">
                  <span class="text-muted-foreground">完成进度</span>
                  <span class="font-medium">{{ Math.round(progress) }}%</span>
                </div>
                <Progress :model-value="progress" class="h-2" />
              </div>

              <div class="space-y-1">
                <div
                  v-for="todo in props.todos"
                  :key="todo.id"
                  class="flex items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
                >
                  <component
                    :is="statusConfig[todo.status].icon"
                    class="mt-0.5 size-4 shrink-0"
                    :class="statusConfig[todo.status].className"
                  />
                  <span
                    :class="{
                      'text-muted-foreground line-through':
                        todo.status === 'completed' || todo.status === 'cancelled',
                      'font-medium': todo.status === 'in_progress',
                    }"
                  >
                    {{ todo.content }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <ScrollArea v-else-if="activeTab === 'files'" class="h-full">
          <div class="space-y-3 p-3">
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
            <div v-else class="rounded-lg bg-muted/40 p-2">
              <WorkspaceFileTree :items="files" />
            </div>
          </div>
        </ScrollArea>

        <div v-else-if="activeTab === 'app'" ref="viewAnchor" class="ai-app-anchor h-full w-full" />
      </div>
    </Sidebar>
  </aside>
</template>
