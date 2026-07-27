<script setup lang="ts">
import type { FileSearchItem } from "@shared/api";
import { FileIcon } from "lucide-vue-next";
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
    console.error("搜索工作区文件失败:", error);
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
    <p class="px-2 pb-1 text-xs font-medium text-muted-foreground">文件</p>
    <p
      v-if="loading"
      class="px-2 py-2 text-sm text-muted-foreground"
      data-slot="file-search-loading"
    >
      正在搜索文件…
    </p>
    <p
      v-else-if="loadError"
      class="px-2 py-2 text-sm text-destructive"
      data-slot="file-search-error"
    >
      无法搜索工作区文件
    </p>
    <p
      v-else-if="files.length === 0"
      class="px-2 py-2 text-sm text-muted-foreground"
      data-slot="file-search-empty"
    >
      没有匹配的文件
    </p>
    <div v-else class="space-y-0.5">
      <button
        v-for="file in files"
        :key="file.relativePath"
        type="button"
        class="grid h-9 w-full grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-accent"
        data-slot="file-search-item"
        :title="file.relativePath"
        @click="emit('select', file)"
      >
        <FileIcon class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="text-sm font-medium whitespace-nowrap text-foreground">
          {{ file.name }}
        </span>
        <span
          v-if="file.relativePath !== file.name"
          class="truncate text-sm text-muted-foreground"
          data-slot="file-search-path"
        >
          {{ file.relativePath }}
        </span>
      </button>
    </div>
  </div>
</template>
