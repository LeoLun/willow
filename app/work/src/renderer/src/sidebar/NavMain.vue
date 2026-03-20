<script setup lang="ts">
import { onBeforeMount } from "vue";
import { FolderPlus, SquarePen, Clock, LayoutGrid } from "lucide-vue-next";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button";
// import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { electronAPI } from "@/lib/ipc";
import { ref } from "vue";
import type { Workspace } from "@shared/api";

const workspaceList = ref<Workspace[]>([]);


onBeforeMount(() => {
  // 读取工作空间列表
  electronAPI.getWorkspaceList().then((response) => {
    workspaceList.value = response.workspaces || [];
  });
})
</script>

<template>
  <SidebarGroup>
    <SidebarGroupContent>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-pointer">
            <SquarePen />
            <span>新会话</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-pointer">
            <Clock />
            <span>自动化</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton class="cursor-pointer">
            <LayoutGrid />
            <span>技能</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
      <SidebarGroup class="mt-[20px]">
        <SidebarGroupLabel class="flex items-center justify-between">
          <div>工作空间</div>
          <div>
            <Button variant="ghost" size="icon-sm">
              <FolderPlus />
            </Button>
          </div>
        </SidebarGroupLabel>
        <SidebarMenu>
          <SidebarMenuItem v-for="workspace in workspaceList" :key="workspace.id">
            <SidebarMenuButton>
              <span>{{ workspace.name }}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroup>

      <!-- <SidebarGroup as-child>
        <Collapsible default-open class="group/collapsible">
          <SidebarGroupLabel as-child>
            <CollapsibleTrigger
              class="group/label w-full text-left text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground [&[data-state=open]>svg]:rotate-90">
              Help
              <ChevronRight class="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
            </CollapsibleTrigger>
          </SidebarGroupLabel>
          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <span>默认空间</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </Collapsible>
      </SidebarGroup> -->

    </SidebarGroupContent>
  </SidebarGroup>
</template>
