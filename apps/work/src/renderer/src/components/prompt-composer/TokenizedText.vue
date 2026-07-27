<script setup lang="ts">
import { computed } from "vue";
import { parseComposerContent } from "./token-parser";
import type { ComposerTokenRule } from "./types";

const props = defineProps<{
  content: string;
  tokenRules: readonly ComposerTokenRule[];
}>();

const segments = computed(() => parseComposerContent(props.content, props.tokenRules));
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <span v-if="segment.type === 'text'">{{ segment.content }}</span>
    <span
      v-else
      class="mx-0.5 inline-flex align-middle"
      :data-token-rule="segment.ruleId"
      :data-token-source="segment.source"
    >
      <component :is="segment.component" v-bind="segment.props" />
    </span>
  </template>
</template>
