<script setup lang="ts">
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@willow/shadcn/components/ui/context-menu";
import { Copy, ExternalLink, FolderSearch } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  kind: "directory" | "file";
  path: string;
}>();

const emit = defineEmits<{
  copy: [path: string];
  open: [path: string];
  reveal: [path: string];
}>();

const normalizedPath = computed(() =>
  props.path.endsWith("/") ? props.path.slice(0, -1) : props.path,
);
</script>

<template>
  <ContextMenu>
    <ContextMenuTrigger as-child>
      <slot />
    </ContextMenuTrigger>
    <ContextMenuContent class="w-48">
      <ContextMenuItem @select="emit('reveal', normalizedPath)">
        <FolderSearch />
        打开所在文件夹
      </ContextMenuItem>
      <template v-if="kind === 'file'">
        <ContextMenuItem @select="emit('open', normalizedPath)">
          <ExternalLink />
          使用系统应用打开
        </ContextMenuItem>
        <ContextMenuItem @select="emit('copy', normalizedPath)">
          <Copy />
          复制文件路径
        </ContextMenuItem>
      </template>
    </ContextMenuContent>
  </ContextMenu>
</template>
