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
      class="inline-flex h-7 items-center gap-1 rounded-full !bg-[color-mix(in_srgb,var(--color-emerald-600)_12%,transparent)] px-2.5 align-middle text-sm leading-none !text-[var(--color-emerald-600)]"
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
