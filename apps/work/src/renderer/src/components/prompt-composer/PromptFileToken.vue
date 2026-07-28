<script setup lang="ts">
import { FileIcon, FolderIcon } from "lucide-vue-next";
import { computed } from "vue";

const props = defineProps<{
  fileName: string;
  path: string;
}>();

const isDirectory = computed(() => props.path.endsWith("/"));
</script>

<template>
  <span class="inline-flex items-center gap-1 text-blue-500" :title="path">
    <FolderIcon v-if="isDirectory" class="size-4 shrink-0" data-icon-type="directory" />
    <FileIcon v-else class="size-4 shrink-0" data-icon-type="file" />
    <span>{{ fileName }}</span>
  </span>
</template>
