<script setup lang="ts">
import { StreamingMessageContainer } from "@willow/ui";
import { demoTools, pendingToolCalls, streamingMessage } from "../mock-data";
</script>

<template>
  <div class="rounded-2xl border border-border bg-card py-5 shadow-sm">
    <StreamingMessageContainer
      :message="streamingMessage"
      :tools="demoTools"
      :pending-tool-calls="pendingToolCalls"
      :is-streaming="true"
    />
  </div>
</template>
