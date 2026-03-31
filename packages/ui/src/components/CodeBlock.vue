<script setup lang="ts">
import hljs from "highlight.js/lib/core";
import bash from "highlight.js/lib/languages/bash";
import css from "highlight.js/lib/languages/css";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import { Check, Copy } from "lucide-vue-next";
import { computed, ref } from "vue";
import { i18n } from "../utils/i18n";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("typescript", typescript);
hljs.registerLanguage("python", python);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("xml", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("json", json);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);

const props = withDefaults(
  defineProps<{
    code: string;
    language?: string;
  }>(),
  { language: "" },
);

const copied = ref(false);

function getDecodedCode(): string {
  try {
    return decodeURIComponent(escape(atob(props.code)));
  } catch {
    return props.code;
  }
}

const decodedCode = computed(() => getDecodedCode());

const highlighted = computed(() => {
  const code = decodedCode.value;
  if (props.language && hljs.getLanguage(props.language)) {
    return hljs.highlight(code, { language: props.language }).value;
  }
  return hljs.highlightAuto(code).value;
});

const displayLanguage = computed(() => props.language || "plaintext");

async function copyCode() {
  try {
    await navigator.clipboard.writeText(decodedCode.value);
    copied.value = true;
    setTimeout(() => {
      copied.value = false;
    }, 1500);
  } catch (e) {
    console.error("Copy failed", e);
  }
}
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border">
    <div class="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5">
      <span class="font-mono text-xs text-muted-foreground">{{ displayLanguage }}</span>
      <button
        class="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="i18n('Copy code')"
        @click="copyCode"
      >
        <Check v-if="copied" class="h-3.5 w-3.5" />
        <Copy v-else class="h-3.5 w-3.5" />
        <span v-if="copied">{{ i18n("Copied!") }}</span>
      </button>
    </div>
    <div class="max-h-96 overflow-auto">
      <pre
        class="m-0 !rounded-none !border-0 !bg-transparent font-mono text-xs text-foreground"
      ><code class="hljs" :class="`language-${displayLanguage}`" v-html="highlighted"></code></pre>
    </div>
  </div>
</template>
