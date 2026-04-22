<script setup lang="ts">
import { Badge } from "@willow/shadcn/components/ui/badge";
import { cn } from "@willow/shadcn/lib/utils";
import { FileCodeIcon, FileJsonIcon, FileTextIcon, ImageIcon } from "lucide-vue-next";
import { computed } from "vue";
import type { SenderFileOption } from "../types";

const props = withDefaults(
  defineProps<{
    files: SenderFileOption[];
    filesLoading?: boolean;
    filesErrorMessage?: string;
    query: string;
    activeIndex: number;
    selectedFileKeys: Set<string>;
    isSearchMode: boolean;
  }>(),
  {
    filesLoading: false,
    filesErrorMessage: "",
  },
);

const emit = defineEmits<{
  select: [file: SenderFileOption];
}>();

const normalizedQuery = computed(() => props.query.trim().toLowerCase());

const filteredFiles = computed(() => {
  if (!props.isSearchMode || !normalizedQuery.value) {
    return props.files;
  }

  return props.files.filter((file) => {
    const haystack = `${file.name} ${file.relativePath}`.toLowerCase();
    return haystack.includes(normalizedQuery.value);
  });
});

function getFileKey(file: Pick<SenderFileOption, "path">) {
  return file.path;
}

function iconForFile(extension?: string) {
  switch (extension) {
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

function getFileItemClasses(file: SenderFileOption, index: number) {
  const isActive = index === props.activeIndex;
  const isSelected = props.selectedFileKeys.has(getFileKey(file));
  return cn(
    "flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left transition-colors",
    isActive ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
    isSelected ? "opacity-80" : "",
  );
}

defineExpose({ filteredFiles });
</script>

<template>
  <div
    class="absolute right-0 bottom-[calc(100%_+_0.625rem)] left-0 z-10 overflow-hidden rounded-xl border border-border bg-card shadow-lg"
  >
    <div class="px-3 pt-3 text-sm font-medium text-foreground">文件</div>

    <div v-if="filesLoading" class="px-3 py-2 text-sm text-muted-foreground">正在加载文件...</div>
    <div v-else-if="filesErrorMessage" class="px-3 py-2 text-sm text-destructive">
      {{ filesErrorMessage }}
    </div>
    <div v-else-if="files.length === 0" class="px-3 py-2 text-sm text-muted-foreground">
      当前工作空间没有可引用的文件。
    </div>
    <div
      v-else-if="isSearchMode && filteredFiles.length === 0"
      class="px-3 py-2 text-sm text-muted-foreground"
    >
      没有匹配 @{{ query }} 的文件。
    </div>
    <div v-else class="max-h-72 overflow-y-auto p-2">
      <button
        v-for="(file, index) in filteredFiles"
        :key="getFileKey(file)"
        type="button"
        :class="getFileItemClasses(file, index)"
        @mousedown.prevent
        @click="emit('select', file)"
      >
        <component
          :is="iconForFile(file.extension)"
          class="size-4 shrink-0 text-muted-foreground"
        />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium">{{ file.name }}</div>
          <div class="truncate text-xs text-muted-foreground">{{ file.relativePath }}</div>
        </div>
        <Badge v-if="file.extension" variant="outline" class="ml-2 shrink-0 text-[11px]">
          {{ file.extension }}
        </Badge>
      </button>
    </div>
  </div>
</template>
