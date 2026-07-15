<script setup lang="ts">
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@willow/shadcn";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@willow/shadcn/components/ui/sidebar";
import { ChevronDown, Clock3, Folder, Share2, PanelLeft } from "lucide-vue-next";
import type { Component } from "vue";
import { baseShadowStyles } from "@/components/ui/base-shadow";
import { Button } from "@/components/ui/button";

interface QuickAccessItem {
  id: string;
  label: string;
  icon: Component;
}

interface SidebarItem {
  id: string;
  label: string;
}

interface SidebarProject {
  id: string;
  label: string;
  icon: Component;
  items: SidebarItem[];
}

interface SidebarSection {
  id: string;
  label: string;
  projects: SidebarProject[];
}

const selectedItem = defineModel<string>({ default: "text-edit" });
const { state, toggleSidebar } = useSidebar();

const quickAccess: QuickAccessItem[] = [
  { id: "text-edit", label: "新建任务", icon: Folder },
  { id: "recents", label: "Recents", icon: Clock3 },
  { id: "shared", label: "Shared", icon: Share2 },
];

const sections: SidebarSection[] = [
  {
    id: "top",
    label: "置顶",
    projects: [
      {
        id: "project-1",
        label: "项目 1",
        icon: Folder,
        items: [
          { id: "project-1-item-1", label: "item1" },
          { id: "project-1-item-2", label: "item2" },
          { id: "project-1-item-3", label: "item3" },
        ],
      },
    ],
  },
  {
    id: "projects",
    label: "项目",
    projects: [
      {
        id: "project-2",
        label: "项目 2",
        icon: Folder,
        items: [
          { id: "project-2-item-1", label: "item1" },
          { id: "project-2-item-2", label: "item2" },
          { id: "project-2-item-3", label: "item3" },
        ],
      },
    ],
  },
];
</script>

<template>
  <Button
    class="no-drag-region absolute top-[12px] z-100 transition-[left] duration-200 ease-linear will-change-[left]"
    :class="state === 'collapsed' ? 'left-[90px]' : 'left-[194px]'"
    :variant="state === 'collapsed' ? 'default' : 'borderless'"
    shape="capsule"
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
    <SidebarHeader class="h-12 flex-row items-center justify-end px-3 pl-[76px]"> </SidebarHeader>

    <SidebarContent class="gap-0 px-1 pb-3">
      <SidebarGroup class="px-2 py-0">
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem v-for="item in quickAccess" :key="item.id">
              <SidebarMenuButton
                :is-active="selectedItem === item.id"
                class="h-8 items-center rounded-lg px-2.5 text-[13px] leading-4 font-medium text-sidebar-foreground/85 data-[active=true]:bg-sidebar-foreground/10"
                @click="selectedItem = item.id"
              >
                <component
                  :is="item.icon"
                  :class="selectedItem === item.id ? 'text-primary' : 'text-sidebar-foreground/85'"
                />
                <span
                  :class="selectedItem === item.id ? 'text-primary' : 'text-sidebar-foreground/85'"
                  >{{ item.label }}</span
                >
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <SidebarGroup v-for="section in sections" :key="section.id" class="px-2 py-1">
        <SidebarGroupLabel
          class="mt-3 h-6 px-2 text-[11px] leading-3.5 font-semibold text-sidebar-foreground/50"
        >
          {{ section.label }}
        </SidebarGroupLabel>

        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <Collapsible
              v-for="project in section.projects"
              :key="project.id"
              v-slot="{ open }"
              as-child
              :default-open="true"
              class="group/collapsible"
            >
              <SidebarMenuItem>
                <CollapsibleTrigger as-child>
                  <SidebarMenuButton
                    class="h-8 items-center rounded-lg px-2.5 text-[13px] leading-4 text-sidebar-foreground/85"
                  >
                    <component :is="project.icon" />
                    <span>{{ project.label }}</span>
                    <ChevronDown
                      class="ml-auto size-4 transition-transform duration-200 dark:text-white/25"
                      :class="open ? '' : '-rotate-90'"
                    />
                  </SidebarMenuButton>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <SidebarMenuSub>
                    <SidebarMenuSubItem v-for="item in project.items" :key="item.id">
                      <SidebarMenuSubButton
                        as="button"
                        :is-active="selectedItem === item.id"
                        class="h-8 w-full rounded-lg text-[13px] leading-4 text-sidebar-foreground/85 data-[active=true]:bg-sidebar-foreground/10"
                        @click="selectedItem = item.id"
                      >
                        <span>{{ item.label }}</span>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  </SidebarMenuSub>
                </CollapsibleContent>
              </SidebarMenuItem>
            </Collapsible>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>
  </Sidebar>
</template>
