<script setup lang="ts">
import { NodeViewWrapper } from "@tiptap/vue-3";
import { FileTextIcon } from "lucide-vue-next";

defineProps<{
  node: {
    attrs: {
      name: string;
      path: string;
      relativePath: string;
      extension?: string;
    };
  };
}>();
</script>

<template>
  <NodeViewWrapper as="span" class="file-tag-wrapper">
    <span
      contenteditable="false"
      class="inline-flex h-7 items-center gap-1 rounded-full !bg-primary/12 px-2.5 align-middle text-sm leading-none !text-primary"
    >
      <FileTextIcon class="size-3.5 shrink-0" />
      <span class="max-w-[13rem] truncate font-medium">{{ node.attrs.name }}</span>
    </span>
  </NodeViewWrapper>
</template>

<style scoped>
.file-tag-wrapper {
  display: inline;
  user-select: none;
}
</style>
