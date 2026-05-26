<script setup lang="ts">
import type { WorkspaceFileNode } from "@shared/api";
import { Button } from "@willow/shadcn/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@willow/shadcn/components/ui/collapsible";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  FileCodeIcon,
  FileJsonIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
} from "lucide-vue-next";
import { inject } from "vue";

defineOptions({
  name: "WorkspaceFileTree",
});

const props = withDefaults(
  defineProps<{
    items: WorkspaceFileNode[];
    level?: number;
    workspaceId: number;
  }>(),
  {
    level: 0,
  },
);

const selectFile = inject<(path: string, name: string) => void>("selectFile");

function handleOpenFile(item: WorkspaceFileNode) {
  if (selectFile) {
    selectFile(item.path, item.name);
  }
}

function iconForFile(extension?: string) {
  switch (extension) {
    case "md":
      return FileTextIcon;
    case "json":
      return FileJsonIcon;
    case "ts":
    case "js":
    case "tsx":
    case "jsx":
    case "vue":
    case "py":
      return FileCodeIcon;
    case "png":
    case "jpg":
    case "jpeg":
    case "svg":
    case "gif":
      return ImageIcon;
    default:
      return FileTextIcon;
  }
}
</script>

<template>
  <div class="space-y-0.5">
    <template v-for="item in props.items" :key="item.path">
      <Collapsible v-if="item.type === 'folder'" v-slot="{ open }" :default-open="props.level < 1">
        <CollapsibleTrigger as-child>
          <Button
            variant="ghost"
            class="h-8 w-full justify-start gap-1 rounded-md px-2 py-1 text-sm font-normal"
            :style="{ paddingLeft: `${props.level * 12 + 8}px` }"
          >
            <ChevronDownIcon v-if="open" class="size-3.5 shrink-0 text-muted-foreground" />
            <ChevronRightIcon v-else class="size-3.5 shrink-0 text-muted-foreground" />
            <FolderIcon class="size-4 shrink-0 text-amber-500" />
            <span class="truncate">{{ item.name }}</span>
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <WorkspaceFileTree
            v-if="item.children && item.children.length > 0"
            :items="item.children"
            :level="props.level + 1"
            :workspace-id="props.workspaceId"
          />
        </CollapsibleContent>
      </Collapsible>

      <Button
        v-else
        variant="ghost"
        class="h-8 w-full cursor-pointer justify-start gap-2 rounded-md px-2 py-1 text-sm font-normal"
        :style="{ paddingLeft: `${props.level * 12 + 24}px` }"
        @click="handleOpenFile(item)"
      >
        <component
          :is="iconForFile(item.extension)"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <span class="truncate">{{ item.name }}</span>
      </Button>
    </template>
  </div>
</template>
