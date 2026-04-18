<script setup lang="ts">
import { NodeViewWrapper } from "@tiptap/vue-3";
import { BoxesIcon } from "lucide-vue-next";

defineProps<{
  node: {
    attrs: {
      name: string;
      filePath: string;
      scope: string;
      scopeLabel: string;
    };
  };
}>();
</script>

<template>
  <NodeViewWrapper as="span" class="skill-tag-wrapper">
    <span
      contenteditable="false"
      class="inline-flex items-center gap-1 rounded-full bg-primary/12 px-2.5 align-baseline text-sm leading-normal text-primary"
    >
      <BoxesIcon class="size-3.5 shrink-0" />
      <span class="max-w-[13rem] truncate font-medium">{{ node.attrs.name }}</span>
    </span>
  </NodeViewWrapper>
</template>

<style scoped>
.skill-tag-wrapper {
  display: inline;
  user-select: none;
}
</style>
