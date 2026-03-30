<script setup lang="ts">
import katex from "katex";
import { Marked } from "marked";
import { computed } from "vue";
import CodeBlock from "./CodeBlock.vue";

const props = withDefaults(
  defineProps<{
    content: string;
    isThinking?: boolean;
    escapeHtml?: boolean;
  }>(),
  { isThinking: false, escapeHtml: true },
);

const renderedHtml = computed(() => {
  if (!props.content) return "";

  let preservedContent = props.content;
  if (props.escapeHtml) {
    const codeBlocks: string[] = [];
    preservedContent = props.content.replace(/```[\s\S]*?```|`[^`\n]+`/g, (match) => {
      const index = codeBlocks.length;
      codeBlocks.push(match);
      return `__CODE_BLOCK_${index}__`;
    });
    preservedContent = preservedContent
      .replace(/<(\w+)([^>]*)>/g, "&lt;$1$2&gt;")
      .replace(/<\/(\w+)>/g, "&lt;/$1&gt;")
      .replace(/<(\w+)([^>]*)\s*\/>/g, "&lt;$1$2/&gt;")
      .replace(/<(?![^\s])/g, "&lt;");
    codeBlocks.forEach((block, index) => {
      preservedContent = preservedContent.replace(`__CODE_BLOCK_${index}__`, block);
    });
  }

  const katexMode = "html";

  const marked = new Marked();
  marked.use({
    extensions: [
      {
        name: "inlineMathDollar",
        level: "inline",
        start(src: string) {
          return src.indexOf("$");
        },
        tokenizer(src: string) {
          const match = /^\$([^$\n]+?)\$/s.exec(src);
          if (match) {
            return { type: "inlineMathDollar", raw: match[0], text: match[1].trim() };
          }
          return undefined;
        },
        renderer(token: any) {
          try {
            return katex.renderToString(token.text, {
              throwOnError: false,
              displayMode: false,
              output: katexMode,
            });
          } catch {
            return `<span class="text-red-500 font-mono">$${token.text}$</span>`;
          }
        },
      },
      {
        name: "blockMathDollar",
        level: "block",
        start(src: string) {
          return src.indexOf("$$");
        },
        tokenizer(src: string) {
          const match = /^\$\$([^$]+?)\$\$/s.exec(src);
          if (match) {
            return { type: "blockMathDollar", raw: match[0], text: match[1].trim() };
          }
          return undefined;
        },
        renderer(token: any) {
          try {
            return `<div class="my-4">${katex.renderToString(token.text, { throwOnError: false, displayMode: true, output: katexMode })}</div>`;
          } catch {
            return `<div class="my-4 text-red-500 font-mono">$$${token.text}$$</div>`;
          }
        },
      },
      {
        name: "inlineMathLatex",
        level: "inline",
        start(src: string) {
          return src.indexOf("\\(");
        },
        tokenizer(src: string) {
          const match = /^\\\((.+?)\\\)/s.exec(src);
          if (match) {
            return { type: "inlineMathLatex", raw: match[0], text: match[1].trim() };
          }
          return undefined;
        },
        renderer(token: any) {
          try {
            return katex.renderToString(token.text, {
              throwOnError: false,
              displayMode: false,
              output: katexMode,
            });
          } catch {
            return `<span class="text-red-500 font-mono">\\(${token.text}\\)</span>`;
          }
        },
      },
      {
        name: "blockMathLatex",
        level: "block",
        start(src: string) {
          return src.indexOf("\\[");
        },
        tokenizer(src: string) {
          const match = /^\\\[(.+?)\\\]/s.exec(src);
          if (match) {
            return { type: "blockMathLatex", raw: match[0], text: match[1].trim() };
          }
          return undefined;
        },
        renderer(token: any) {
          try {
            return `<div class="my-4">${katex.renderToString(token.text, { throwOnError: false, displayMode: true, output: katexMode })}</div>`;
          } catch {
            return `<div class="my-4 text-red-500 font-mono">\\[${token.text}\\]</div>`;
          }
        },
      },
    ],
  });

  const renderer = new marked.Renderer();
  const originalLink = renderer.link;
  renderer.link = function (token: any) {
    const link = originalLink.call(this, token);
    return link.replace("<a ", '<a target="_blank" rel="noopener noreferrer" ');
  };

  const originalTable = renderer.table;
  renderer.table = function (token: any) {
    const table = originalTable.call(this, token);
    return `<div class="overflow-x-auto my-2 border border-border rounded">${table}</div>`;
  };

  let parsedContent = marked.parse(preservedContent, {
    async: false,
    renderer: renderer,
  }) as string;

  // Replace fenced code blocks with data attributes for the Vue component to pick up
  parsedContent = parsedContent.replace(
    /<pre><code class="language-(\w+)">([\s\S]+?)<\/code><\/pre>/g,
    (_match, lang, code) => {
      const unescaped = code
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&#x27;/g, "'")
        .replace(/&amp;/g, "&");
      const base64Code = btoa(unescape(encodeURIComponent(unescaped)));
      return `<div class="mt-2 willow-code-block" data-lang="${lang}" data-code="${base64Code}"></div>`;
    },
  );

  parsedContent = parsedContent.replace(/<pre><code>([\s\S]+?)<\/code><\/pre>/g, (_match, code) => {
    const unescaped = code
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&#x27;/g, "'")
      .replace(/&amp;/g, "&");
    const base64Code = btoa(unescape(encodeURIComponent(unescaped)));
    return `<div class="mt-2 willow-code-block" data-lang="text" data-code="${base64Code}"></div>`;
  });

  return parsedContent;
});

const containerClasses = computed(() =>
  props.isThinking
    ? "markdown-content text-muted-foreground italic max-w-none break-words overflow-wrap-anywhere text-sm [&>*:last-child]:!mb-0"
    : "markdown-content text-foreground max-w-none break-words overflow-wrap-anywhere [&>*:last-child]:!mb-0",
);

// We need to render CodeBlock components for any code blocks in the parsed HTML.
// Since v-html can't render Vue components, we use a post-mount approach
// with Teleport-like behavior via onMounted.
import { nextTick, onMounted, onUpdated, ref } from "vue";
import { createApp, h } from "vue";

const containerRef = ref<HTMLElement>();
const codeBlockApps: any[] = [];

function mountCodeBlocks() {
  if (!containerRef.value) return;

  // Clean up previous code block instances
  for (const app of codeBlockApps) {
    app.unmount();
  }
  codeBlockApps.length = 0;

  const placeholders = containerRef.value.querySelectorAll(".willow-code-block");
  for (const el of placeholders) {
    const lang = el.getAttribute("data-lang") || "text";
    const code = el.getAttribute("data-code") || "";
    const app = createApp({
      render() {
        return h(CodeBlock, { code, language: lang });
      },
    });
    app.mount(el);
    codeBlockApps.push(app);
  }
}

onMounted(() => {
  nextTick(mountCodeBlocks);
});

onUpdated(() => {
  nextTick(mountCodeBlocks);
});

import { onBeforeUnmount } from "vue";
onBeforeUnmount(() => {
  for (const app of codeBlockApps) {
    app.unmount();
  }
  codeBlockApps.length = 0;
});
</script>

<template>
  <div ref="containerRef" :class="containerClasses" v-html="renderedHtml"></div>
</template>
