<script setup lang="ts">
import AssistantMessage from "./roles/AssistantMessage.vue";
import ToolMessage from "./roles/ToolMessage.vue";
import UserMessage from "./roles/UserMessage.vue";
import type { Message } from "./types";

defineProps<{
  messages: readonly Message[];
}>();
</script>

<template>
  <div class="flex flex-col gap-4" data-slot="message-list">
    <template v-for="message in messages" :key="message.id">
      <UserMessage v-if="message.role === 'user'" :message="message" />
      <AssistantMessage v-else-if="message.role === 'assistant'" :message="message" />
      <ToolMessage v-else :message="message" />
    </template>
  </div>
</template>
