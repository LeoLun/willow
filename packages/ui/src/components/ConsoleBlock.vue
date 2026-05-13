<script setup lang="ts">
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import { Check, Copy } from "lucide-vue-next";
import { ref, watch, nextTick, computed, onMounted } from "vue";
import { ensureHighlightTheme } from "../utils/highlight-theme";
import { i18n } from "../utils/i18n";

hljs.registerLanguage("bash", bash);
const props = withDefaults(
  defineProps<{
    content?: string;
    variant?: "default" | "error";
  }>(),
  { content: "", variant: "default" },
);

const copied = ref(false);
const scrollContainer = ref<HTMLElement>();

async function copy() {
  try {
    await navigator.clipboard.writeText(props.content || "");
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch (e) {
    console.error("Copy failed", e);
  }
}

const highlighted = computed(() => {
  const code = props.content || "";
  return hljs.highlight(code, { language: "bash" }).value;
});

watch(
  () => props.content,
  async () => {
    await nextTick();
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  },
);

onMounted(() => {
  ensureHighlightTheme();
});
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border">
    <div class="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5">
      <span class="font-mono text-xs text-muted-foreground">{{ i18n("console") }}</span>
      <button
        class="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="i18n('copy_output')"
        @click="copy"
      >
        <Check v-if="copied" class="h-3.5 w-3.5" />
        <Copy v-else class="h-3.5 w-3.5" />
        <span v-if="copied">{{ i18n("Copied!") }}</span>
      </button>
    </div>
    <div ref="scrollContainer" class="console-scroll max-h-64 overflow-auto">
      <pre
        class="m-0 !rounded-none !border-0 !bg-background font-mono text-xs whitespace-pre-wrap"
        :class="variant === 'error' ? 'text-destructive' : 'text-foreground'"
      ><code class="hljs" :class="`language-bash`" v-html="highlighted"></code></pre>
    </div>
  </div>
</template>
