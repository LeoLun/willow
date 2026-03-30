<script setup lang="ts">
import { Check, Copy } from "lucide-vue-next";
import { ref, watch, nextTick } from "vue";
import { i18n } from "../utils/i18n";

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

watch(
  () => props.content,
  async () => {
    await nextTick();
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  },
);
</script>

<template>
  <div class="overflow-hidden rounded-lg border border-border">
    <div class="flex items-center justify-between border-b border-border bg-muted px-3 py-1.5">
      <span class="font-mono text-xs text-muted-foreground">{{ i18n("console") }}</span>
      <button
        class="flex cursor-pointer items-center gap-1 rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        :title="i18n('Copy output')"
        @click="copy"
      >
        <Check v-if="copied" class="h-3.5 w-3.5" />
        <Copy v-else class="h-3.5 w-3.5" />
        <span v-if="copied">{{ i18n("Copied!") }}</span>
      </button>
    </div>
    <div ref="scrollContainer" class="console-scroll max-h-64 overflow-auto">
      <pre
        class="m-0 !rounded-none !border-0 !bg-background p-3 font-mono text-xs whitespace-pre-wrap"
        :class="variant === 'error' ? 'text-destructive' : 'text-foreground'"
        >{{ content || "" }}</pre
      >
    </div>
  </div>
</template>
