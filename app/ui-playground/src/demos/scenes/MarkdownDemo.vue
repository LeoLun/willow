<script setup lang="ts">
import { MarkdownBlock } from "@willow/ui";
import { markdownSample } from "../mock-data";
</script>

<template>
  <div class="rounded-2xl border border-border bg-card p-6 shadow-sm">
    <MarkdownBlock :content="markdownSample" />
  </div>
</template>
