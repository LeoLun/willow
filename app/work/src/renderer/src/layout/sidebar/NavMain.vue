<script setup lang="ts">
import { onBeforeMount, ref } from "vue";
import { FolderPlus, SquarePen, Clock, LayoutGrid, Ellipsis } from "lucide-vue-next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarGroupLabel,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button";
import { useDialog } from "@/layout/dialog";
import { CreateWorkspace } from "@/layout/dialog/create-workspace";
import { DeleteWorkspace } from "@/layout/dialog/delete-workspace";
import { RenameWorkspace } from "@/layout/dialog/rename-workspace";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useRouter } from "vue-router";
import { storeToRefs } from "pinia";
import { useWorkspaceStore } from "@/stores/workspace";
import type { Workspace } from "@shared/api";

const router = useRouter();
const { openDialog } = useDialog();
const workspaceStore = useWorkspaceStore();
const { workspaceList } = storeToRefs(workspaceStore);
const dropdownOpenId = ref<number | null>(null);

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

onBeforeMount(() => {
  workspaceStore.fetchWorkspaceList();
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

      <SidebarGroupLabel class="flex items-center justify-between mt-[20px]">
        <div>工作空间</div>
        <div>
          <Button variant="ghost" class="size-6 text-neutral-500" @click="handleCreateWorkspace">
            <FolderPlus />
          </Button>
        </div>
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem v-for="workspace in workspaceList" :key="workspace.id" class="group/workspace">
          <SidebarMenuButton class="flex items-center justify-between">
            <div>{{ workspace.name }}</div>
            <div
              class="flex items-center gap-2 transition-opacity"
              :class="dropdownOpenId === workspace.id ? 'opacity-100' : 'opacity-0 group-hover/workspace:opacity-100'"
            >
              <Button variant="ghost" class="size-6 text-neutral-500" @click="router.push(`/?workspaceId=${workspace.id}`)">
                <SquarePen />
              </Button>
              <DropdownMenu @update:open="(open: boolean) => dropdownOpenId = open ? workspace.id : null">
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" class="size-6 text-neutral-500">
                    <Ellipsis />
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
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroupContent>
  </SidebarGroup>
</template>
