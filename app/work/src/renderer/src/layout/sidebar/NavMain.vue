<script setup lang="ts">
import type { Workspace, Session } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@willow/shadcn/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
} from "@willow/shadcn/components/ui/sidebar";
import { FolderPlus, SquarePen, Clock, LayoutGrid, Ellipsis, ChevronRight } from "lucide-vue-next";
import { storeToRefs } from "pinia";
import { onBeforeMount, ref, computed } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useDialog } from "@/layout/dialog";
import { CreateWorkspace } from "@/layout/dialog/create-workspace";
import { DeleteSession } from "@/layout/dialog/delete-session";
import { DeleteWorkspace } from "@/layout/dialog/delete-workspace";
import { RenameSession } from "@/layout/dialog/rename-session";
import { RenameWorkspace } from "@/layout/dialog/rename-workspace";
import { useSessionStore } from "@/stores/session";
import { useWorkspaceStore } from "@/stores/workspace";

const router = useRouter();
const route = useRoute();
const { openDialog } = useDialog();
const workspaceStore = useWorkspaceStore();
const sessionStore = useSessionStore();
const { workspaceList } = storeToRefs(workspaceStore);
const { sessionMap } = storeToRefs(sessionStore);
const dropdownOpenId = ref<string | null>(null);

// 获取当前路由的 sessionId
const sessionId = computed(() => {
  return Number(route.params.sessionId);
});

function handleRenameSession(session: Session) {
  openDialog(RenameSession, {
    session,
    onRenamed: () => sessionStore.fetchSessionList(workspaceList.value.map((w) => w.id)),
  });
}

function handleDeleteSession(session: Session) {
  openDialog(DeleteSession, {
    session,
    onDeleted: () => {
      if (sessionId.value === session.id) {
        void router.push({
          path: "/",
          query: { workspaceId: String(session.workspaceId) },
        });
      }
    },
  });
}

function handleRenameWorkspace(workspace: Workspace) {
  openDialog(RenameWorkspace, {
    workspace,
    onRenamed: () => workspaceStore.fetchWorkspaceList(),
  });
}

function handleDeleteWorkspace(workspace: Workspace) {
  openDialog(DeleteWorkspace, {
    workspace,
    onDeleted: () => workspaceStore.fetchWorkspaceList(),
  });
}

function handleCreateWorkspace() {
  openDialog(CreateWorkspace, {
    onCreated: () => workspaceStore.fetchWorkspaceList(),
  });
}

onBeforeMount(async () => {
  const workspaces = await workspaceStore.fetchWorkspaceList();
  await sessionStore.fetchSessionList(workspaces.map((w) => w.id));
});
</script>

<template>
  <SidebarGroup class="p-0">
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-pointer" @click="router.push('/')">
            <SquarePen />
            <span>新会话</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-pointer" @click="router.push('/auto')">
            <Clock />
            <span>自动化</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-pointer" @click="router.push('/skills')">
            <LayoutGrid />
            <span>技能</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>

      <SidebarGroupLabel class="mt-[20px] flex items-center justify-between">
        <div>工作空间</div>
        <Button variant="ghost" class="size-6 text-neutral-500" @click="handleCreateWorkspace">
          <FolderPlus class="size-3.5" />
        </Button>
      </SidebarGroupLabel>
      <SidebarMenu>
        <Collapsible
          v-for="workspace in workspaceList"
          :key="workspace.id"
          as-child
          class="group/collapsible"
        >
          <SidebarMenuItem class="group/workspace">
            <div class="flex items-center">
              <CollapsibleTrigger as-child>
                <SidebarMenuButton class="flex-1 cursor-pointer hover:!bg-transparent">
                  <ChevronRight
                    class="size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90"
                  />
                  <span>{{ workspace.name }}</span>
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <div
                class="flex items-center gap-2 pr-2 transition-opacity"
                :class="
                  dropdownOpenId === `ws-${workspace.id}`
                    ? 'opacity-100'
                    : 'opacity-0 group-hover/workspace:opacity-100'
                "
                @click.stop
                @pointerdown.stop
              >
                <Button
                  variant="ghost"
                  class="size-6 text-neutral-500"
                  @click="router.push(`/?workspaceId=${workspace.id}`)"
                >
                  <SquarePen class="size-3.5" />
                </Button>
                <DropdownMenu
                  @update:open="
                    (open: boolean) => (dropdownOpenId = open ? `ws-${workspace.id}` : null)
                  "
                >
                  <DropdownMenuTrigger as-child>
                    <Button variant="ghost" class="size-6 text-neutral-500">
                      <Ellipsis class="size-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem @click="handleRenameWorkspace(workspace)">
                      <span>重命名</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem @click="handleDeleteWorkspace(workspace)">
                      <span>删除</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
            <CollapsibleContent class="CollapsibleContent">
              <SidebarMenuSub class="mr-1 pr-0">
                <template v-if="sessionMap[workspace.id] && sessionMap[workspace.id].length > 0">
                  <SidebarMenuSubItem
                    v-for="session in sessionMap[workspace.id] || []"
                    :key="session.id"
                    class="group/session"
                  >
                    <SidebarMenuSubButton
                      as="div"
                      class="cursor-pointer pr-1"
                      :is-active="sessionId === session.id"
                      @click="router.push(`/${session.id}`)"
                    >
                      <span class="flex-1 truncate">{{ session.title || "未命名会话" }}</span>
                      <DropdownMenu
                        @update:open="
                          (open: boolean) => (dropdownOpenId = open ? `ss-${session.id}` : null)
                        "
                      >
                        <DropdownMenuTrigger as-child @click.stop @pointerdown.stop>
                          <Button
                            variant="ghost"
                            class="size-6 shrink-0 text-neutral-500 transition-opacity"
                            :class="
                              dropdownOpenId === `ss-${session.id}`
                                ? 'opacity-100'
                                : 'opacity-0 group-hover/session:opacity-100'
                            "
                          >
                            <Ellipsis class="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem @click="handleRenameSession(session)">
                            <span>重命名</span>
                          </DropdownMenuItem>
                          <DropdownMenuItem @click="handleDeleteSession(session)">
                            <span>删除</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                </template>
                <template v-else>
                  <SidebarMenuSubItem>
                    <div
                      class="flex h-full items-center justify-start pl-[6px] text-xs text-neutral-400"
                    >
                      暂无会话
                    </div>
                  </SidebarMenuSubItem>
                </template>
                <SidebarMenuSubItem v-if="sessionStore.hasMoreSessions(workspace.id)">
                  <SidebarMenuSubButton
                    as="div"
                    class="cursor-pointer text-neutral-400 hover:text-neutral-600"
                    @click="router.push(`/workspace/${workspace.id}/history`)"
                  >
                    <span class="text-xs">查看更多...</span>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              </SidebarMenuSub>
            </CollapsibleContent>
          </SidebarMenuItem>
        </Collapsible>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
