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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from "@willow/shadcn/components/ui/sidebar";
import {
  ChevronDown,
  CircleArrowDown,
  Clock3,
  Cloud,
  FileText,
  Folder,
  HardDrive,
  House,
  Monitor,
  Share2,
  Tag,
  Trash2,
  SquareDashed,
} from "lucide-vue-next";
import type { Component } from "vue";
import { Button } from "@/components/ui/button";

interface SidebarItem {
  id: string;
  label: string;
  icon: Component;
  detail?: string;
  color?: string;
}

interface SidebarSection {
  id: string;
  label: string;
  detail?: string;
  items: SidebarItem[];
}

const selectedItem = defineModel<string>({ default: "text-edit" });
const { state, toggleSidebar } = useSidebar();

const quickAccess: SidebarItem[] = [
  { id: "text-edit", label: "Text Edit", icon: Folder, detail: "Detail" },
  { id: "recents", label: "Recents", icon: Clock3, detail: "Detail" },
  { id: "shared", label: "Shared", icon: Share2, detail: "Detail" },
];

const sections: SidebarSection[] = [
  {
    id: "favorites",
    label: "Favorites",
    items: [
      { id: "desktop", label: "Desktop", icon: Monitor, detail: "Detail" },
      { id: "documents", label: "Documents", icon: FileText, detail: "Detail" },
      { id: "downloads", label: "Downloads", icon: CircleArrowDown, detail: "Detail" },
    ],
  },
  {
    id: "locations",
    label: "Locations",
    detail: "Detail",
    items: [
      { id: "icloud", label: "iCloud Drive", icon: Cloud, detail: "Detail" },
      { id: "home", label: "Home", icon: House, detail: "Detail" },
      { id: "macintosh-hd", label: "Macintosh HD", icon: HardDrive, detail: "Detail" },
      { id: "trash", label: "Trash", icon: Trash2, detail: "Detail" },
    ],
  },
  {
    id: "tags",
    label: "Tags",
    items: [
      { id: "important", label: "Important", icon: Tag, color: "text-red-500" },
      { id: "work", label: "Work", icon: Tag, color: "text-blue-500" },
      { id: "personal", label: "Personal", icon: Tag, color: "text-violet-500" },
    ],
  },
];
</script>

<template>
  <Button
    class="no-drag-region absolute top-[12px] z-100 transition-[left] duration-200 ease-linear will-change-[left]"
    :class="state === 'collapsed' ? 'left-[90px]' : 'left-[192px]'"
    :variant="state === 'collapsed' ? 'default' : 'borderless'"
    shape="capsule"
    @click="toggleSidebar"
  >
    <SquareDashed />
  </Button>

  <Sidebar
    variant="floating"
    collapsible="offcanvas"
    class="[&>[data-sidebar=sidebar]]:border-white/50 [&>[data-sidebar=sidebar]]:bg-sidebar/90 [&>[data-sidebar=sidebar]]:shadow-xl [&>[data-sidebar=sidebar]]:backdrop-blur-2xl"
  >
    <SidebarHeader class="h-12 flex-row items-center justify-end px-3 pl-[76px]">
      <!-- <SidebarTrigger class=" text-sidebar-foreground/65 hover:bg-black/5" /> -->
    </SidebarHeader>

    <SidebarContent class="gap-0 px-1 pb-3">
      <SidebarGroup class="px-2 py-0">
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem v-for="item in quickAccess" :key="item.id">
              <SidebarMenuButton
                :is-active="selectedItem === item.id"
                class="h-8 rounded-lg px-2.5 text-[13px] font-medium data-[active=true]:bg-black/10 dark:data-[active=true]:bg-white/12"
                @click="selectedItem = item.id"
              >
                <component
                  :is="item.icon"
                  :class="selectedItem === item.id ? 'text-primary' : 'text-sidebar-foreground/80'"
                />
                <span
                  :class="selectedItem === item.id ? 'text-primary' : 'text-sidebar-foreground/80'"
                  >{{ item.label }}</span
                >
              </SidebarMenuButton>
              <SidebarMenuBadge class="right-2 text-[11px] font-normal text-sidebar-foreground/45">
                {{ item.detail }}
              </SidebarMenuBadge>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <Collapsible
        v-for="section in sections"
        :key="section.id"
        v-slot="{ open }"
        :default-open="true"
        class="group/collapsible"
      >
        <SidebarGroup class="px-2 py-1">
          <CollapsibleTrigger as-child>
            <SidebarGroupLabel
              class="h-7 w-full cursor-default justify-between px-2 text-[11px] font-semibold text-sidebar-foreground/55"
            >
              <span>{{ section.label }}</span>
              <span class="flex items-center gap-1 font-normal">
                <span v-if="section.detail">{{ section.detail }}</span>
                <ChevronDown
                  class="size-3.5 transition-transform duration-200"
                  :class="open ? '' : '-rotate-90'"
                />
              </span>
            </SidebarGroupLabel>
          </CollapsibleTrigger>

          <CollapsibleContent>
            <SidebarGroupContent>
              <SidebarMenu class="gap-0.5">
                <SidebarMenuItem v-for="item in section.items" :key="item.id">
                  <SidebarMenuButton
                    :is-active="selectedItem === item.id"
                    class="h-8 rounded-lg px-2.5 text-[13px] data-[active=true]:bg-black/10 dark:data-[active=true]:bg-white/12"
                    @click="selectedItem = item.id"
                  >
                    <component
                      :is="item.icon"
                      :class="
                        selectedItem === item.id ? 'text-primary' : 'text-sidebar-foreground/80'
                      "
                    />
                    <span
                      :class="
                        selectedItem === item.id ? 'text-primary' : 'text-sidebar-foreground/80'
                      "
                      >{{ item.label }}</span
                    >
                  </SidebarMenuButton>
                  <SidebarMenuBadge
                    v-if="item.detail"
                    class="right-2 text-[11px] font-normal text-sidebar-foreground/45"
                  >
                    {{ item.detail }}
                  </SidebarMenuBadge>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </CollapsibleContent>
        </SidebarGroup>
      </Collapsible>
    </SidebarContent>

    <!-- <SidebarRail /> -->
  </Sidebar>
</template>
