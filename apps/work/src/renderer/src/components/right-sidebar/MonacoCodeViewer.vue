<script setup lang="ts">
import type { editor } from "monaco-editor/editor/editor.api";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useDarkMode } from "@/composables/useDarkMode";
import { loadMonaco, type Monaco } from "./monaco";

const props = withDefaults(
  defineProps<{
    ariaLabel?: string;
    code: string;
    language: string;
  }>(),
  {
    ariaLabel: "只读代码预览",
  },
);

const editorContainer = ref<HTMLElement>();
const loadError = ref("");
const ready = ref(false);
const { isDark } = useDarkMode();

const theme = computed(() => (isDark.value ? "vs-dark" : "vs"));

let disposed = false;
let monaco: Monaco | undefined;
let codeEditor: editor.IStandaloneCodeEditor | undefined;

function currentModel(): editor.ITextModel | null | undefined {
  return codeEditor?.getModel();
}

watch(
  () => props.code,
  (code) => {
    const model = currentModel();
    if (model && model.getValue() !== code) model.setValue(code);
  },
);

watch(
  () => props.language,
  (language) => {
    const model = currentModel();
    if (monaco && model) monaco.editor.setModelLanguage(model, language);
  },
);

watch(
  () => props.ariaLabel,
  (ariaLabel) => {
    codeEditor?.updateOptions({ ariaLabel });
  },
);

watch(theme, (value) => {
  monaco?.editor.setTheme(value);
});

onMounted(async () => {
  try {
    const loadedMonaco = await loadMonaco();
    if (disposed || !editorContainer.value) return;

    monaco = loadedMonaco;
    monaco.editor.setTheme(theme.value);
    codeEditor = monaco.editor.create(editorContainer.value, {
      ariaLabel: props.ariaLabel,
      automaticLayout: true,
      codeLens: false,
      colorDecorators: false,
      domReadOnly: true,
      folding: false,
      fontSize: 12,
      glyphMargin: false,
      hover: { enabled: "off" },
      language: props.language,
      lightbulb: { enabled: monaco.editor.ShowLightbulbIconMode.Off },
      lineDecorationsWidth: 8,
      lineHeight: 24,
      lineNumbersMinChars: 3,
      links: false,
      minimap: { enabled: false },
      overviewRulerBorder: false,
      overviewRulerLanes: 0,
      padding: { bottom: 8, top: 8 },
      parameterHints: { enabled: false },
      quickSuggestions: false,
      readOnly: true,
      readOnlyMessage: { value: "只读预览" },
      renderLineHighlight: "none",
      renderValidationDecorations: "off",
      scrollBeyondLastColumn: 0,
      scrollBeyondLastLine: false,
      stickyScroll: { enabled: false },
      suggestOnTriggerCharacters: false,
      theme: theme.value,
      value: props.code,
      wordWrap: "off",
    });
    ready.value = true;
  } catch (error) {
    if (disposed) return;
    loadError.value = error instanceof Error ? error.message : "未知错误";
  }
});

onBeforeUnmount(() => {
  disposed = true;
  const model = currentModel();
  codeEditor?.dispose();
  model?.dispose();
  codeEditor = undefined;
  monaco = undefined;
});
</script>

<template>
  <div
    class="relative h-full min-h-0 w-full overflow-hidden"
    data-slot="monaco-code-viewer"
    :data-language="language"
  >
    <div
      ref="editorContainer"
      class="absolute inset-0"
      :class="{ invisible: !ready }"
      data-slot="monaco-editor"
    />

    <div
      v-if="!ready && !loadError"
      class="absolute inset-0 flex items-center justify-center text-xs text-muted-foreground"
      data-slot="monaco-loading"
    >
      正在加载代码预览…
    </div>

    <div
      v-else-if="loadError"
      class="absolute inset-0 flex items-center justify-center px-5 text-center text-xs text-destructive"
      data-slot="monaco-error"
      role="alert"
    >
      无法加载代码预览：{{ loadError }}
    </div>
  </div>
</template>
