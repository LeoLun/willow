<script setup lang="ts">
import { MessageList } from "@willow/ui";
import { conversationMessages, demoTools } from "../mock-data";
</script>

<template>
  <div class="rounded-2xl border border-border bg-card py-5 shadow-sm">
    <MessageList :messages="conversationMessages" :tools="demoTools" />
  </div>
</template>
