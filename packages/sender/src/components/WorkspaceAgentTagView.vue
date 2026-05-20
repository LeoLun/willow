<script setup lang="ts">
import { NodeViewWrapper } from "@tiptap/vue-3";
import { BotIcon } from "lucide-vue-next";

defineProps<{
  node: {
    attrs: {
      workspaceId: number;
      workspaceName: string;
      agentName: string;
      agentDescription: string;
    };
  };
}>();
</script>

<template>
  <NodeViewWrapper as="span" class="workspace-agent-tag-wrapper">
    <span
      contenteditable="false"
      class="inline-flex h-7 max-w-[18rem] items-center gap-1 rounded-full !bg-[color-mix(in_srgb,var(--color-sky-600)_12%,transparent)] px-2.5 align-middle text-sm leading-none !text-[var(--color-sky-700)]"
      :title="node.attrs.agentDescription || node.attrs.workspaceName"
    >
      <BotIcon class="size-3.5 shrink-0" />
      <span class="truncate font-medium">{{ node.attrs.agentName }}</span>
      <span class="truncate text-[color-mix(in_srgb,var(--color-sky-700)_68%,transparent)]">
        {{ node.attrs.workspaceName }}
      </span>
    </span>
  </NodeViewWrapper>
</template>

<style scoped>
.workspace-agent-tag-wrapper {
  display: inline;
  user-select: none;
}
</style>
