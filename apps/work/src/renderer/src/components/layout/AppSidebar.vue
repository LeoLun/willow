<script setup lang="ts">
import type { SessionInfo, WorkspaceInfo } from "@shared/api";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@willow/shadcn/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@willow/shadcn/components/ui/sidebar";
import {
  Clock3,
  Ellipsis,
  Folder,
  FolderOpen,
  LoaderCircle,
  PanelLeft,
  Pencil,
  Pin,
  PinOff,
  Plus,
  RefreshCw,
  Settings,
  Trash2,
} from "lucide-vue-next";
import type { Component } from "vue";
import { computed, shallowRef, watch } from "vue";
import { useRoute, useRouter, type LocationQueryRaw } from "vue-router";
import { useDialog } from "@/components/dialog";
import SettingDialog from "@/components/dialog/setting/Setting.vue";
import CreateWorkspaceDialog from "@/components/dialog/workspace/CreateWorkspaceDialog.vue";
import DeleteWorkspaceDialog from "@/components/dialog/workspace/DeleteWorkspaceDialog.vue";
import RenameWorkspaceDialog from "@/components/dialog/workspace/RenameWorkspaceDialog.vue";
import { baseShadowStyles } from "@/components/ui/base-shadow";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/composables/useWorkspace";

interface QuickAccessItem {
  id: string;
  label: string;
  icon: Component;
}

const WORKSPACE_OPEN_STATE_STORAGE_KEY = "willow:workspace-session-open-state";
const SESSION_DISPLAY_LIMIT = 5;

function loadWorkspaceOpenState(): Record<string, boolean> {
  try {
    const value = localStorage.getItem(WORKSPACE_OPEN_STATE_STORAGE_KEY);
    if (!value) return {};

    const parsed: unknown = JSON.parse(value);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return {};

    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, boolean] => {
        return typeof entry[1] === "boolean";
      }),
    );
  } catch {
    return {};
  }
}

const selectedItem = defineModel<string>({ default: "text-edit" });
const workspaceOpenState = shallowRef(loadWorkspaceOpenState());
const expandedSessionLists = shallowRef<Record<string, boolean>>({});
const { state, toggleSidebar } = useSidebar();
const { openDialog } = useDialog();
const route = useRoute();
const router = useRouter();

const {
  pinnedWorkspaces,
  unpinnedWorkspaces,
  loading,
  workspaceError,
  updatingWorkspaceId,
  loadWorkspaces,
  loadWorkspaceSessions,
  setWorkspacePinned,
} = useWorkspace();

const selectedWorkspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});
const selectedSessionId = computed(() => {
  const value = route.params.sessionId;
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
});
const isInitialLoading = computed(
  () =>
    loading.value && pinnedWorkspaces.value.length === 0 && unpinnedWorkspaces.value.length === 0,
);
const workspaceGroups = computed(() => [
  ...(pinnedWorkspaces.value.length > 0
    ? [
        {
          id: "pinned",
          label: "置顶",
          workspaces: pinnedWorkspaces.value,
          showCreateAction: false,
        },
      ]
    : []),
  {
    id: "projects",
    label: "项目",
    workspaces: unpinnedWorkspaces.value,
    showCreateAction: true,
  },
]);

const quickAccess: QuickAccessItem[] = [
  { id: "task", label: "新建任务", icon: Folder },
  { id: "auto", label: "自动化", icon: Clock3 },
];

function isWorkspaceOpen(workspaceId: number) {
  return workspaceOpenState.value[String(workspaceId)] ?? true;
}

function setWorkspaceOpen(workspaceId: number, open: boolean) {
  workspaceOpenState.value = {
    ...workspaceOpenState.value,
    [workspaceId]: open,
  };

  try {
    localStorage.setItem(
      WORKSPACE_OPEN_STATE_STORAGE_KEY,
      JSON.stringify(workspaceOpenState.value),
    );
  } catch {
    // Keep the in-memory state when localStorage is unavailable or full.
  }
}

function isSessionListExpanded(workspaceId: number) {
  return expandedSessionLists.value[String(workspaceId)] ?? false;
}

function getVisibleSessions(workspaceId: number, sessions: SessionInfo[]) {
  return isSessionListExpanded(workspaceId) ? sessions : sessions.slice(0, SESSION_DISPLAY_LIMIT);
}

function toggleSessionList(workspaceId: number) {
  expandedSessionLists.value = {
    ...expandedSessionLists.value,
    [workspaceId]: !isSessionListExpanded(workspaceId),
  };
}

function openSettingDialog() {
  openDialog(SettingDialog, undefined, {
    contentClass:
      "h-[min(700px,calc(100vh-2rem))] max-w-[calc(100vw-2rem)] gap-0 overflow-hidden p-0 sm:max-w-[min(950px,calc(100vw-2rem))]",
  });
}

function openCreateWorkspaceDialog() {
  openDialog(
    CreateWorkspaceDialog,
    {
      onCreated: () => void loadWorkspaces(),
    },
    { contentClass: "sm:max-w-md" },
  );
}

function openRenameWorkspaceDialog(workspace: WorkspaceInfo) {
  openDialog(
    RenameWorkspaceDialog,
    {
      workspace,
      onRenamed: () => void loadWorkspaces(),
    },
    { contentClass: "sm:max-w-md" },
  );
}

function openDeleteWorkspaceDialog(workspace: WorkspaceInfo) {
  openDialog(
    DeleteWorkspaceDialog,
    {
      workspace,
      onDeleted: (workspaceId: number) => void handleWorkspaceDeleted(workspaceId),
    },
    { contentClass: "sm:max-w-md" },
  );
}

async function handleWorkspaceDeleted(workspaceId: number) {
  await loadWorkspaces();
  if (selectedWorkspaceId.value !== workspaceId) return;

  selectedItem.value = "text-edit";
  const query: LocationQueryRaw = { ...route.query };
  delete query.workspaceId;
  delete query.sessionId;
  await router.push({ name: "home", query });
}

async function selectWorkspace(workspace: WorkspaceInfo) {
  selectedItem.value = "";
  const query: LocationQueryRaw = { ...route.query, workspaceId: String(workspace.id) };
  delete query.sessionId;
  await router.push({ name: "home", query });
}

async function selectSession(session: SessionInfo) {
  selectedItem.value = "";
  await router.push({
    name: "chat",
    params: { sessionId: session.id },
    query: { workspaceId: String(session.workspaceId) },
  });
}

async function selectQuickAccess(itemId: string) {
  selectedItem.value = itemId;
  if (itemId === "auto") {
    await router.push({ name: "auto" });
    return;
  }
  if (itemId === "task") {
    const query: LocationQueryRaw = { ...route.query };
    delete query.workspaceId;
    delete query.sessionId;
    await router.push({ name: "home", query });
    return;
  }
}

function toggleWorkspacePinned(workspace: WorkspaceInfo) {
  void setWorkspacePinned(workspace);
}

watch(selectedSessionId, (sessionId, previousSessionId) => {
  if (sessionId && sessionId !== previousSessionId && selectedWorkspaceId.value) {
    void loadWorkspaceSessions(selectedWorkspaceId.value);
  }
});
</script>

<template>
  <Button
    class="no-drag-region absolute top-[12px] z-50 transition-[left] duration-200 ease-linear will-change-[left]"
    :class="state === 'collapsed' ? 'left-[90px]' : 'left-[194px]'"
    :variant="state === 'collapsed' ? 'default' : 'borderless'"
    shape="capsule"
    aria-label="切换侧边栏"
    @click="toggleSidebar"
  >
    <PanelLeft />
  </Button>

  <Sidebar
    variant="floating"
    collapsible="offcanvas"
    class="[&>[data-sidebar=sidebar]]:rounded-3xl [&>[data-sidebar=sidebar]]:border-sidebar-border [&>[data-sidebar=sidebar]]:bg-sidebar/90 [&>[data-sidebar=sidebar]]:backdrop-blur-2xl"
    :class="baseShadowStyles.glassSidebar"
  >
    <SidebarHeader class="h-12 flex-row items-center justify-end px-3 pl-[76px]" />

    <SidebarHeader class="h-20">
      <SidebarGroup class="px-2 py-0">
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem v-for="item in quickAccess" :key="item.id">
              <SidebarMenuButton
                :is-active="selectedWorkspaceId === undefined && selectedItem === item.id"
                class="h-8 items-center rounded-lg px-2.5 text-sm leading-4 font-medium text-sidebar-foreground/85 data-[active=true]:bg-sidebar-foreground/10"
                @click="selectQuickAccess(item.id)"
              >
                <component
                  :is="item.icon"
                  :class="
                    selectedWorkspaceId === undefined && selectedItem === item.id
                      ? 'text-primary'
                      : 'text-sidebar-foreground/85'
                  "
                />
                <span
                  :class="
                    selectedWorkspaceId === undefined && selectedItem === item.id
                      ? 'text-primary'
                      : ''
                  "
                  >{{ item.label }}</span
                >
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarHeader>

    <SidebarContent class="gap-0 px-1 pb-3">
      <div
        v-if="isInitialLoading"
        class="flex items-center gap-2 px-4 py-5 text-sm text-sidebar-foreground/60"
      >
        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
        正在加载工作空间…
      </div>

      <div v-else>
        <div
          v-if="workspaceError"
          class="mx-3 mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          <span>{{ workspaceError }}</span>
          <button
            type="button"
            class="shrink-0 rounded-md p-1 hover:bg-destructive/10"
            aria-label="重新加载工作空间"
            title="重试"
            @click="loadWorkspaces"
          >
            <RefreshCw class="size-3.5" />
          </button>
        </div>

        <SidebarGroup v-for="group in workspaceGroups" :key="group.id" class="px-2 py-1">
          <SidebarGroupLabel
            class="mt-3 flex h-6 items-center justify-between px-2 text-[11px] leading-3.5 font-semibold text-sidebar-foreground/50"
          >
            <span>{{ group.label }}</span>
            <button
              v-if="group.showCreateAction"
              type="button"
              class="no-drag-region flex size-6 items-center justify-center rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
              aria-label="添加工作空间"
              title="添加工作空间"
              @click="openCreateWorkspaceDialog"
            >
              <Plus class="size-4" aria-hidden="true" />
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu class="gap-0.5">
              <Collapsible
                v-for="workspace in group.workspaces"
                :key="workspace.id"
                v-slot="{ open }"
                as-child
                :open="isWorkspaceOpen(workspace.id)"
                @update:open="setWorkspaceOpen(workspace.id, $event)"
              >
                <SidebarMenuItem>
                  <CollapsibleTrigger as-child>
                    <SidebarMenuButton
                      class="h-8 items-center rounded-lg px-2.5 pr-14 text-sm leading-4"
                    >
                      <FolderOpen v-if="open" />
                      <Folder v-else />
                      <span class="truncate">{{ workspace.name }}</span>
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <SidebarMenuAction
                    show-on-hover
                    class="right-7"
                    :aria-label="`新建会话：${workspace.name}`"
                    :title="`新建会话：${workspace.name}`"
                    @click.stop="selectWorkspace(workspace)"
                  >
                    <Plus aria-hidden="true" />
                  </SidebarMenuAction>
                  <DropdownMenu>
                    <DropdownMenuTrigger as-child>
                      <SidebarMenuAction
                        show-on-hover
                        :disabled="updatingWorkspaceId !== undefined"
                        :aria-label="`更多工作空间操作：${workspace.name}`"
                        :title="`更多操作：${workspace.name}`"
                        @click.stop
                      >
                        <Ellipsis aria-hidden="true" />
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="bottom" align="start">
                      <DropdownMenuItem @select="toggleWorkspacePinned(workspace)">
                        <PinOff v-if="workspace.pinned" aria-hidden="true" />
                        <Pin v-else aria-hidden="true" />
                        {{ workspace.pinned ? "取消置顶" : "置顶" }}
                      </DropdownMenuItem>
                      <DropdownMenuItem @select="openRenameWorkspaceDialog(workspace)">
                        <Pencil aria-hidden="true" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        variant="destructive"
                        @select="openDeleteWorkspaceDialog(workspace)"
                      >
                        <Trash2 aria-hidden="true" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <CollapsibleContent as-child>
                    <SidebarMenu class="mt-1 gap-1">
                      <SidebarMenuItem v-if="workspace.sessions.length === 0">
                        <p class="h-7 px-2.5 pl-4 text-sm leading-7 text-sidebar-foreground/50">
                          无任务
                        </p>
                      </SidebarMenuItem>
                      <SidebarMenuItem
                        v-for="session in getVisibleSessions(workspace.id, workspace.sessions)"
                        :key="session.id"
                      >
                        <SidebarMenuButton
                          :is-active="selectedSessionId === session.id"
                          class="h-7 items-center rounded-lg px-2.5 pl-4 text-sm data-[active=true]:bg-sidebar-foreground/10"
                          @click="selectSession(session)"
                        >
                          <span class="truncate">{{ session.title.trim() || "新对话" }}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                      <SidebarMenuItem v-if="workspace.sessions.length > SESSION_DISPLAY_LIMIT">
                        <span
                          class="h-7 cursor-pointer items-center rounded-lg px-2.5 pl-4 text-sm text-sidebar-foreground/60 hover:text-sidebar-foreground"
                          @click.stop="toggleSessionList(workspace.id)"
                        >
                          {{ isSessionListExpanded(workspace.id) ? "折叠显示" : "展开全部" }}
                        </span>
                      </SidebarMenuItem>
                    </SidebarMenu>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </div>
    </SidebarContent>

    <SidebarFooter class="flex h-12 flex-row items-center justify-end gap-2 px-2">
      <Button
        variant="borderless"
        shape="capsule"
        class="flex-1 justify-start"
        @click="openSettingDialog"
      >
        <Settings />
        设置
      </Button>
    </SidebarFooter>
  </Sidebar>
</template>
