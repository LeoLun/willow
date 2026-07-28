<script setup lang="ts">
import type { FileSearchItem } from "@shared/api";
import { FileIcon, FolderIcon } from "lucide-vue-next";
import { onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  workspaceId?: number;
  query: string;
}>();

const emit = defineEmits<{
  select: [file: FileSearchItem];
}>();

const files = shallowRef<FileSearchItem[]>([]);
const loading = ref(false);
const loadError = ref(false);
let generation = 0;
let debounceTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSearch(): void {
  const currentGeneration = ++generation;
  const currentWorkspaceId = props.workspaceId;
  const currentQuery = props.query;
  if (debounceTimer) clearTimeout(debounceTimer);
  files.value = [];
  loadError.value = false;

  if (!currentWorkspaceId) {
    loading.value = false;
    return;
  }

  loading.value = true;
  debounceTimer = setTimeout(() => {
    debounceTimer = undefined;
    void search(currentGeneration, currentWorkspaceId, currentQuery);
  }, 120);
}

async function search(
  currentGeneration: number,
  workspaceId: number,
  query: string,
): Promise<void> {
  try {
    const response = await electronAPI.searchFiles({ workspaceId, query });
    if (currentGeneration !== generation) return;
    files.value = response.files;
  } catch (error) {
    if (currentGeneration !== generation) return;
    loadError.value = true;
    console.error("搜索工作区文件和文件夹失败:", error);
  } finally {
    if (currentGeneration === generation) loading.value = false;
  }
}

watch([() => props.workspaceId, () => props.query], scheduleSearch, { immediate: true });

onBeforeUnmount(() => {
  generation += 1;
  if (debounceTimer) clearTimeout(debounceTimer);
});
</script>

<template>
  <div data-slot="file-search">
    <p class="px-2 text-xs font-medium text-foreground">文件和文件夹</p>
    <p
      v-if="loading"
      class="mt-1 text-sm leading-6 text-muted-foreground"
      data-slot="file-search-loading"
    >
      正在搜索文件和文件夹…
    </p>
    <p
      v-else-if="loadError"
      class="mt-1 text-sm leading-6 text-destructive"
      data-slot="file-search-error"
    >
      无法搜索工作区文件和文件夹
    </p>
    <p
      v-else-if="files.length === 0"
      class="mt-1 text-sm leading-6 text-muted-foreground"
      data-slot="file-search-empty"
    >
      没有匹配的文件或文件夹
    </p>
    <div v-else class="mt-1">
      <button
        v-for="file in files"
        :key="file.relativePath"
        type="button"
        class="grid min-h-7 w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-xl px-2 text-left text-sm leading-6 transition-colors hover:bg-accent/60"
        data-slot="file-search-item"
        :data-entry-type="file.type"
        :title="file.relativePath"
        @click="emit('select', file)"
      >
        <FolderIcon
          v-if="file.type === 'directory'"
          class="size-4 shrink-0 text-muted-foreground"
          data-icon-type="directory"
          aria-hidden="true"
        />
        <FileIcon
          v-else
          class="size-4 shrink-0 text-muted-foreground"
          data-icon-type="file"
          aria-hidden="true"
        />
        <span class="whitespace-nowrap text-foreground">
          {{ file.name }}
        </span>
        <span
          v-if="file.relativePath !== file.name"
          class="truncate text-muted-foreground"
          data-slot="file-search-path"
        >
          {{ file.relativePath }}
        </span>
      </button>
    </div>
  </div>
</template>
