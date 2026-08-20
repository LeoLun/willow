<script setup lang="ts">
import {
  renderMermaidSVG,
  THEMES,
  type DiagramColors,
  type RenderOptions,
} from "beautiful-mermaid";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

type MermaidTheme = string | DiagramColors;

interface Props {
  content: string;
  class?: string;
  height?: string;
  width?: string;
  theme?: MermaidTheme;
  themeDark?: MermaidTheme;
}

const props = withDefaults(defineProps<Props>(), {
  class: "",
  height: "auto",
  width: "100%",
  theme: undefined,
  themeDark: undefined,
});

const isDark = ref(false);
const svgContent = ref("");
const renderError = ref<string>();
let themeObserver: MutationObserver | undefined;

const activeTheme = computed<DiagramColors>(() => {
  const configuredTheme = isDark.value ? (props.themeDark ?? props.theme) : props.theme;
  if (typeof configuredTheme === "string" && THEMES[configuredTheme]) {
    return THEMES[configuredTheme];
  }
  if (typeof configuredTheme === "object") return configuredTheme;
  return THEMES[isDark.value ? "tokyo-night" : "zinc-light"];
});

function stripExternalStyleImports(svg: string): string {
  return svg.replace(/@import\s+url\([^)]*\)\s*;/g, "");
}

function renderDiagram(): void {
  const trimmed = props.content.trim();
  if (!trimmed) {
    svgContent.value = "";
    renderError.value = undefined;
    return;
  }

  try {
    const options: RenderOptions = {
      ...activeTheme.value,
      font: "system-ui",
    };
    // beautiful-mermaid escapes diagram labels, but also emits remote font imports.
    // Remove those imports before the trusted SVG is inserted into the document.
    svgContent.value = stripExternalStyleImports(renderMermaidSVG(trimmed, options));
    renderError.value = undefined;
  } catch (error) {
    if (!svgContent.value) {
      svgContent.value = "";
      renderError.value = error instanceof Error ? error.message : "Failed to render diagram";
    }
  }
}

watch([() => props.content, activeTheme], renderDiagram, { immediate: true });

onMounted(() => {
  const documentElement = document.documentElement;
  isDark.value = documentElement.classList.contains("dark");
  themeObserver = new MutationObserver(() => {
    isDark.value = documentElement.classList.contains("dark");
  });
  themeObserver.observe(documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
});

onBeforeUnmount(() => {
  themeObserver?.disconnect();
});
</script>

<template>
  <div
    class="mermaid"
    :class="props.class"
    :data-error="renderError"
    :style="{
      display: 'flex',
      justifyContent: 'center',
      width: props.width,
      height: props.height,
    }"
    v-html="svgContent"
  ></div>
</template>
