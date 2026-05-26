<script setup lang="ts">
import * as monaco from "monaco-editor";
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import { useDarkMode } from "@/composables/useDarkMode";
import { electronAPI } from "@/lib/ipc";

const props = defineProps<{
  workspaceId: number;
  filePath: string | null;
  fileName: string | null;
}>();

const { isDark } = useDarkMode();
const codeContainer = ref<HTMLDivElement | null>(null);
const loading = ref(false);
const error = ref<string | null>(null);
let editorInstance: monaco.editor.IStandaloneCodeEditor | null = null;

function getLanguageByExtension(ext: string): string {
  const mapping: Record<string, string> = {
    js: "javascript",
    jsx: "javascript",
    ts: "typescript",
    tsx: "typescript",
    json: "json",
    md: "markdown",
    html: "html",
    vue: "html",
    css: "css",
    py: "python",
    sh: "shell",
    yaml: "yaml",
    yml: "yaml",
    xml: "xml",
  };
  return mapping[ext.toLowerCase()] || "plaintext";
}

async function loadFileContent() {
  if (!props.filePath || !props.fileName) {
    if (editorInstance) {
      editorInstance.dispose();
      editorInstance = null;
    }
    return;
  }

  loading.value = true;
  error.value = null;

  try {
    const response = await electronAPI.readFile({
      workspaceId: props.workspaceId,
      path: props.filePath,
    });

    if (editorInstance) {
      editorInstance.dispose();
      editorInstance = null;
    }

    // Give DOM a tick to render container properly
    setTimeout(() => {
      if (!codeContainer.value) return;

      const fileExt = props.fileName!.split(".").pop() || "";
      const language = getLanguageByExtension(fileExt);

      editorInstance = monaco.editor.create(codeContainer.value, {
        value: response.content,
        language: language,
        theme: isDark.value ? "vs-dark" : "vs",
        readOnly: true,
        domReadOnly: true,
        automaticLayout: true,
        minimap: { enabled: false },
        wordWrap: "off",
        fontSize: 13,
        fontFamily: 'Consolas, "Liberation Mono", Menlo, Courier, monospace',
        lineNumbers: "on",
        scrollBeyondLastLine: false,
        folding: true,
      });
      loading.value = false;
    }, 50);
  } catch (err) {
    error.value = err instanceof Error ? err.message : "读取文件失败";
    loading.value = false;
    if (editorInstance) {
      editorInstance.dispose();
      editorInstance = null;
    }
  }
}

watch(
  () => props.filePath,
  () => {
    loadFileContent();
  },
);

watch(isDark, (darkVal) => {
  if (editorInstance) {
    monaco.editor.setTheme(darkVal ? "vs-dark" : "vs");
  }
});

onMounted(() => {
  loadFileContent();
});

onBeforeUnmount(() => {
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
});
</script>

<template>
  <div class="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-card">
    <template v-if="props.filePath && props.fileName">
      <div class="flex shrink-0 items-center justify-between border-b border-border px-3 py-2">
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-foreground">{{ props.fileName }}</div>
        </div>
      </div>

      <div class="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-white dark:bg-[#1e1e1e]">
        <div
          v-if="loading"
          class="absolute inset-0 z-10 flex items-center justify-center bg-white/50 text-sm text-muted-foreground dark:bg-black/50"
        >
          正在加载文件内容...
        </div>
        <div
          v-else-if="error"
          class="absolute inset-0 z-10 flex items-center justify-center p-4 text-center text-sm text-destructive"
        >
          {{ error }}
        </div>

        <!-- Monaco Container -->
        <div ref="codeContainer" class="h-full w-full" />
      </div>

      <div
        class="flex shrink-0 items-center justify-between border-t border-border bg-muted/20 px-3 py-1.5 text-[10px] text-muted-foreground"
      >
        <span>只读模式</span>
        <span>UTF-8</span>
      </div>
    </template>
    <template v-else>
      <div
        class="flex h-full w-full flex-col items-center justify-center p-6 text-center text-muted-foreground"
      >
        <svg
          class="mx-auto mb-2 h-12 w-12 text-muted-foreground/40"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <span class="text-sm">选择左侧文件以进行预览</span>
      </div>
    </template>
  </div>
</template>

<style scoped>
:deep(.monaco-editor .cursors-layer .cursor) {
  display: none !important;
}
</style>
