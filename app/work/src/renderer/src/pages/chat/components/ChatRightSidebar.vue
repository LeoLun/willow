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
} from "lucide-vue-next";
import { computed, ref, toRef, watch } from "vue";
import { useWorkspaceFiles } from "@/composables/useWorkspaceFiles";
import { useWorkspaceSettings } from "@/composables/useWorkspaceSettings";
import { electronAPI } from "@/lib/ipc";
import WorkspaceFileTree from "@/pages/chat/session/components/WorkspaceFileTree.vue";
import { useWorkspaceStore } from "@/stores/workspace";

const props = withDefaults(
  defineProps<{
    mode: "workspace" | "session";
    open: boolean;
    session?: Session;
    workspace?: Workspace;
    messageCount?: number;
    todos?: TodoItem[];
  }>(),
  {
    messageCount: 0,
    todos: () => [],
  },
);

const workspaceStore = useWorkspaceStore();
const widthClass = computed(() => {
  if (props.open) {
    return "w-80 basis-80";
  }
  return "w-0 basis-0";
});
const workspaceId = computed(() => props.workspace?.id ?? props.session?.workspaceId ?? 0);
const activeTab = ref<"primary" | "files" | "agents">(
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
</script>

<template>
  <aside
    class="min-h-0 flex-none overflow-hidden transition-[width,flex-basis] duration-300 ease-in-out"
    :class="widthClass"
  >
    <Sidebar
      side="right"
      collapsible="none"
      class="h-full w-80 border-l border-border bg-card"
      :style="{ '--sidebar-width': props.open ? '20rem' : '0rem' }"
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
                <NavigationMenuLink as-child :active="activeTab === 'agents'">
                  <button type="button" class="h-8" @click="activeTab = 'agents'">
                    <FileText class="size-3.5" />
                    AGENTS.md
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

        <ScrollArea v-else-if="activeTab === 'agents'" class="h-full">
          <div class="px-3 py-2">
            <div class="space-y-3">
              <div class="flex items-center gap-2 text-sm font-medium text-foreground">
                <FileText class="h-4 w-4" />
                <span>AGENTS.md 设置</span>
              </div>
              <div class="space-y-2">
                <Label for="workspace-soul-content" class="text-xs text-muted-foreground">
                  定义 AI 助手的行为和人格特征
                </Label>
                <Textarea
                  id="workspace-soul-content"
                  v-model="soulContent"
                  placeholder="# AI 助手配置&#10;&#10;描述你希望 AI 助手具有的特性..."
                  class="min-h-[240px] resize-none font-mono text-sm"
                />
                <p class="text-xs text-muted-foreground">
                  支持 Markdown 格式，保存到工作空间的 AGENTS.md
                </p>
              </div>
            </div>

            <div v-if="settingsErrorMessage" class="text-xs text-destructive">
              {{ settingsErrorMessage }}
            </div>
            <div v-else-if="saveMessage" class="text-xs text-emerald-600">
              {{ saveMessage }}
            </div>

            <Button class="w-full gap-2" :disabled="isSaving" @click="handleSaveWorkspaceSettings">
              <Save class="h-4 w-4" />
              {{ isSaving ? "保存中..." : "保存设置" }}
            </Button>
          </div>
        </ScrollArea>
      </div>
    </Sidebar>
  </aside>
</template>
