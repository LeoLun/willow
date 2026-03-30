<script setup lang="ts">
import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { computed } from "vue";
import { i18n } from "../utils/i18n";
import CodeBlock from "./CodeBlock.vue";

const props = defineProps<{
  callArgs: any;
  result?: ToolResultMessage;
  hasResult?: boolean;
}>();

function pretty(value: unknown): { content: string; isJson: boolean } {
  try {
    if (typeof value === "string") {
      const maybeJson = JSON.parse(value);
      return { content: JSON.stringify(maybeJson, null, 2), isJson: true };
    }
    return { content: JSON.stringify(value, null, 2), isJson: true };
  } catch {
    return {
      content: typeof value === "string" ? value : String(value),
      isJson: false,
    };
  }
}

const callArgsFormatted = computed(() => pretty(props.callArgs));

const outputFormatted = computed(() => {
  const textOutput =
    props.result?.content
      ?.filter((c) => c.type === "text")
      .map((c: any) => c.text)
      .join("\n") || "";
  return pretty(textOutput);
});

const detailsFormatted = computed(() => pretty(props.result?.details));
</script>

<template>
  <div class="mt-3 flex flex-col gap-2">
    <div>
      <div class="mb-1 text-xs font-medium text-muted-foreground">
        {{ i18n("Call") }}
      </div>
      <CodeBlock :code="callArgsFormatted.content" language="json" />
    </div>
    <div>
      <div class="mb-1 text-xs font-medium text-muted-foreground">
        {{ i18n("Result") }}
      </div>
      <template v-if="hasResult">
        <CodeBlock
          :code="outputFormatted.content"
          :language="outputFormatted.isJson ? 'json' : 'text'"
        />
        <CodeBlock
          :code="detailsFormatted.content"
          :language="detailsFormatted.isJson ? 'json' : 'text'"
        />
      </template>
      <div v-else class="text-xs text-muted-foreground">
        {{ i18n("(no result)") }}
      </div>
    </div>
  </div>
</template>
