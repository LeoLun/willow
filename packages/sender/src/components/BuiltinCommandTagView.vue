<script setup lang="ts">
import { NodeViewWrapper } from "@tiptap/vue-3";
import { CommandIcon } from "lucide-vue-next";

defineProps<{
  node: {
    attrs: {
      id: string;
      name: string;
      description: string;
    };
  };
}>();
</script>

<template>
  <NodeViewWrapper as="span" class="builtin-command-tag-wrapper">
    <span
      contenteditable="false"
      class="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-muted px-2.5 align-middle text-sm leading-none text-foreground"
    >
      <CommandIcon class="size-3.5 shrink-0 text-muted-foreground" />
      <span class="max-w-[13rem] truncate font-medium">{{ node.attrs.name }}</span>
    </span>
  </NodeViewWrapper>
</template>

<style scoped>
.builtin-command-tag-wrapper {
  display: inline;
  user-select: none;
}
</style>
