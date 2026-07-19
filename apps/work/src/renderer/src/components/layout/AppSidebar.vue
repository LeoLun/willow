<script setup lang="ts">
import type { WorkspaceInfo } from "@shared/api";
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
import { computed, onMounted, ref, shallowRef } from "vue";
import { useRoute, useRouter, type LocationQueryRaw } from "vue-router";
import { useDialog } from "@/components/dialog";
import SettingDialog from "@/components/dialog/setting/Setting.vue";
import CreateWorkspaceDialog from "@/components/dialog/workspace/CreateWorkspaceDialog.vue";
import DeleteWorkspaceDialog from "@/components/dialog/workspace/DeleteWorkspaceDialog.vue";
import RenameWorkspaceDialog from "@/components/dialog/workspace/RenameWorkspaceDialog.vue";
import { baseShadowStyles } from "@/components/ui/base-shadow";
import { Button } from "@/components/ui/button";
import { electronAPI } from "@/lib/ipc";

interface QuickAccessItem {
  id: string;
  label: string;
  icon: Component;
}

const selectedItem = defineModel<string>({ default: "text-edit" });
const { state, toggleSidebar } = useSidebar();
const { openDialog } = useDialog();
const route = useRoute();
const router = useRouter();

const pinnedWorkspaces = shallowRef<WorkspaceInfo[]>([]);
const unpinnedWorkspaces = shallowRef<WorkspaceInfo[]>([]);
const loading = ref(false);
const workspaceError = ref("");
const updatingWorkspaceId = ref<number>();

const selectedWorkspaceId = computed(() => {
  const value = Number(route.query.workspaceId);
  return Number.isInteger(value) && value > 0 ? value : undefined;
});
const isInitialLoading = computed(
  () =>
    loading.value && pinnedWorkspaces.value.length === 0 && unpinnedWorkspaces.value.length === 0,
);

const quickAccess: QuickAccessItem[] = [
  { id: "text-edit", label: "新建任务", icon: Folder },
  { id: "recents", label: "自动化", icon: Clock3 },
];

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

async function loadWorkspaces() {
  if (loading.value) return;

  loading.value = true;
  workspaceError.value = "";
  try {
    const [pinnedResponse, unpinnedResponse] = await Promise.all([
      electronAPI.getWorkspaceList({ pinned: true }),
      electronAPI.getWorkspaceList({ pinned: false }),
    ]);
    pinnedWorkspaces.value = pinnedResponse.workspaces;
    unpinnedWorkspaces.value = unpinnedResponse.workspaces;
  } catch (error) {
    workspaceError.value = getErrorMessage(error, "读取工作空间失败，请重试。");
  } finally {
    loading.value = false;
  }
}

function openSettingDialog() {
  openDialog(SettingDialog, undefined, {
    contentClass:
      "h-[min(680px,calc(100vh-2rem))] max-w-4xl gap-0 overflow-hidden p-0 sm:max-w-4xl",
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

async function selectQuickAccess(itemId: string) {
  selectedItem.value = itemId;
  const query: LocationQueryRaw = { ...route.query };
  delete query.workspaceId;
  delete query.sessionId;
  await router.push({ name: "home", query });
}

async function setWorkspacePinned(workspace: WorkspaceInfo) {
  if (updatingWorkspaceId.value !== undefined) return;

  updatingWorkspaceId.value = workspace.id;
  workspaceError.value = "";
  try {
    await electronAPI.setWorkspacePinned({
      workspaceId: workspace.id,
      pinned: !workspace.pinned,
    });
    await loadWorkspaces();
  } catch (error) {
    workspaceError.value = getErrorMessage(error, "更新置顶状态失败，请重试。");
  } finally {
    updatingWorkspaceId.value = undefined;
  }
}

onMounted(() => void loadWorkspaces());
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
                class="h-8 items-center rounded-lg px-2.5 text-[13px] leading-4 font-medium text-sidebar-foreground/85 data-[active=true]:bg-sidebar-foreground/10"
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
        class="flex items-center gap-2 px-4 py-5 text-xs text-sidebar-foreground/60"
      >
        <LoaderCircle class="size-4 animate-spin" aria-hidden="true" />
        正在加载工作空间…
      </div>

      <div v-else>
        <div
          v-if="workspaceError"
          class="mx-3 mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"
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

        <SidebarGroup v-if="pinnedWorkspaces.length > 0" class="px-2 py-1">
          <SidebarGroupLabel
            class="mt-3 h-6 px-2 text-[11px] leading-3.5 font-semibold text-sidebar-foreground/50"
          >
            置顶
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu class="gap-0.5">
              <SidebarMenuItem v-for="workspace in pinnedWorkspaces" :key="workspace.id">
                <SidebarMenuButton
                  :is-active="selectedWorkspaceId === workspace.id"
                  class="h-8 items-center rounded-lg px-2.5 pr-14 text-[13px] leading-4 text-sidebar-foreground/85 data-[active=true]:bg-sidebar-foreground/10"
                  @click="selectWorkspace(workspace)"
                >
                  <Folder />
                  <span class="truncate">{{ workspace.name }}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  show-on-hover
                  class="right-7"
                  :disabled="updatingWorkspaceId !== undefined"
                  :aria-label="`取消置顶 ${workspace.name}`"
                  :title="`取消置顶 ${workspace.name}`"
                  @click.stop="setWorkspacePinned(workspace)"
                >
                  <LoaderCircle
                    v-if="updatingWorkspaceId === workspace.id"
                    class="animate-spin"
                    aria-hidden="true"
                  />
                  <PinOff v-else aria-hidden="true" />
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
                  <DropdownMenuContent side="right" align="start">
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
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup class="px-2 py-1">
          <SidebarGroupLabel
            class="mt-3 flex h-6 items-center justify-between px-2 text-[11px] leading-3.5 font-semibold text-sidebar-foreground/50"
          >
            <span>项目</span>
            <button
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
              <SidebarMenuItem v-for="workspace in unpinnedWorkspaces" :key="workspace.id">
                <SidebarMenuButton
                  :is-active="selectedWorkspaceId === workspace.id"
                  class="h-8 items-center rounded-lg px-2.5 pr-14 text-[13px] leading-4 text-sidebar-foreground/85 data-[active=true]:bg-sidebar-foreground/10"
                  @click="selectWorkspace(workspace)"
                >
                  <Folder />
                  <span class="truncate">{{ workspace.name }}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  show-on-hover
                  class="right-7"
                  :disabled="updatingWorkspaceId !== undefined"
                  :aria-label="`置顶 ${workspace.name}`"
                  :title="`置顶 ${workspace.name}`"
                  @click.stop="setWorkspacePinned(workspace)"
                >
                  <LoaderCircle
                    v-if="updatingWorkspaceId === workspace.id"
                    class="animate-spin"
                    aria-hidden="true"
                  />
                  <Pin v-else aria-hidden="true" />
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
                  <DropdownMenuContent side="right" align="start">
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
              </SidebarMenuItem>
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
