<script setup lang="ts">
import type { TurnFileArtifact } from "@shared/api";
import { ChevronDown, FileDiff } from "lucide-vue-next";
import { computed, ref } from "vue";

const props = defineProps<{ files: readonly TurnFileArtifact[] }>();

const DEFAULT_VISIBLE_COUNT = 3;
const open = ref(false);
const additions = computed(() =>
  props.files.reduce((total, file) => total + (file.additions ?? 0), 0),
);
const deletions = computed(() =>
  props.files.reduce((total, file) => total + (file.deletions ?? 0), 0),
);
const initialFiles = computed(() => props.files.slice(0, DEFAULT_VISIBLE_COUNT));
const remainingFiles = computed(() => props.files.slice(DEFAULT_VISIBLE_COUNT));

function statusLabel(file: TurnFileArtifact): string {
  if (file.status === "added") return "新增";
  if (file.status === "deleted") return "删除";
  if (file.status === "renamed") return "重命名";
  return "修改";
}
</script>

<template>
  <section
    class="overflow-hidden rounded-xl border border-border/80 bg-card"
    data-slot="file-artifact-card"
  >
    <header class="flex min-h-14 items-center gap-3 border-b px-3 py-2">
      <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <FileDiff class="size-4 text-muted-foreground" aria-hidden="true" />
      </span>
      <div class="min-w-0 flex-1">
        <p class="font-medium">已更改 {{ props.files.length }} 个文件</p>
        <p class="text-xs tabular-nums">
          <span v-if="additions > 0" class="text-emerald-600">+{{ additions }}</span>
          <span v-if="deletions > 0" class="ml-1 text-red-600">-{{ deletions }}</span>
          <span v-if="additions === 0 && deletions === 0" class="text-muted-foreground">
            本轮文件产物
          </span>
        </p>
      </div>
    </header>

    <div class="px-3 py-1">
      <div
        v-for="file in initialFiles"
        :key="`${file.oldPath ?? ''}:${file.path}`"
        class="flex min-h-9 items-center gap-3"
        data-slot="file-artifact-item"
        :title="`${statusLabel(file)}：${file.path}`"
      >
        <span class="min-w-0 flex-1 truncate text-muted-foreground">
          {{ file.oldPath ? `${file.oldPath} → ${file.path}` : file.path }}
        </span>
        <span class="sr-only">{{ statusLabel(file) }}</span>
        <span v-if="file.additions !== undefined" class="shrink-0 text-emerald-600 tabular-nums">
          +{{ file.additions }}
        </span>
        <span v-if="file.deletions !== undefined" class="shrink-0 text-red-600 tabular-nums">
          -{{ file.deletions }}
        </span>
      </div>

      <template v-if="remainingFiles.length > 0">
        <div
          v-for="file in open ? remainingFiles : []"
          :key="`${file.oldPath ?? ''}:${file.path}`"
          class="flex min-h-9 items-center gap-3"
          data-slot="file-artifact-item"
          :title="`${statusLabel(file)}：${file.path}`"
        >
          <span class="min-w-0 flex-1 truncate text-muted-foreground">
            {{ file.oldPath ? `${file.oldPath} → ${file.path}` : file.path }}
          </span>
          <span class="sr-only">{{ statusLabel(file) }}</span>
          <span v-if="file.additions !== undefined" class="shrink-0 text-emerald-600 tabular-nums">
            +{{ file.additions }}
          </span>
          <span v-if="file.deletions !== undefined" class="shrink-0 text-red-600 tabular-nums">
            -{{ file.deletions }}
          </span>
        </div>
        <button
          type="button"
          class="flex min-h-9 items-center gap-1 text-sm font-medium text-foreground"
          :aria-expanded="open"
          :aria-label="open ? '收起文件列表' : `再显示 ${remainingFiles.length} 个文件`"
          @click="open = !open"
        >
          {{ open ? "收起文件" : `再显示 ${remainingFiles.length} 个文件` }}
          <ChevronDown
            class="size-4 transition-transform"
            :class="open ? 'rotate-180' : undefined"
            aria-hidden="true"
          />
        </button>
      </template>
    </div>
  </section>
</template>
