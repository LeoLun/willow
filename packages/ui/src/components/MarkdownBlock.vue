<script setup lang="ts">
import katex from "katex";
import { Marked } from "marked";
import { computed } from "vue";
import CodeBlock from "./CodeBlock.vue";
import FileTag from "./FileTag.vue";
import SkillTag from "./SkillTag.vue";
import WorkspaceAgentTag from "./WorkspaceAgentTag.vue";

const props = withDefaults(
  defineProps<{
    content: string;
    isThinking?: boolean;
    escapeHtml?: boolean;
  }>(),
  { isThinking: false, escapeHtml: true },
);

function encodeData(value: string) {
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeData(value: string) {
  return decodeURIComponent(escape(atob(value)));
}

function isExternalHref(href: string) {
  return /^(https?:|mailto:)/i.test(href);
}

function isFileReference(name: string, href: string) {
  if (!name || name.startsWith("$") || isExternalHref(href) || href.startsWith("skill/")) {
    return false;
  }
  return /\.[A-Za-z0-9][A-Za-z0-9_-]*$/.test(name.trim());
}

function isEscapedAt(src: string, index: number) {
  let slashCount = 0;
  for (let i = index - 1; i >= 0 && src[i] === "\\"; i--) {
    slashCount++;
  }
  return slashCount % 2 === 1;
}

function unescapeMarkdownInline(value: string) {
  return value.replace(/\\([\\\])>])/g, "$1");
}

function findLinkLabelEnd(src: string) {
  for (let i = 1; i < src.length; i++) {
    if (src[i] === "]" && !isEscapedAt(src, i)) {
      return i;
    }
  }
  return -1;
}

function parseMarkdownLinkDestination(src: string, start: number) {
  if (src[start] !== "(") {
    return undefined;
  }

  const destinationStart = start + 1;
  if (src[destinationStart] === "<") {
    for (let i = destinationStart + 1; i < src.length; i++) {
      if (src[i] !== ">" || isEscapedAt(src, i)) {
        continue;
      }
      if (src[i + 1] !== ")") {
        return undefined;
      }
      return {
        path: unescapeMarkdownInline(src.slice(destinationStart + 1, i).trim()),
        end: i + 2,
      };
    }
    return undefined;
  }

  let depth = 0;
  for (let i = destinationStart; i < src.length; i++) {
    const char = src[i];
    if (isEscapedAt(src, i)) {
      continue;
    }
    if (char === "(") {
      depth++;
      continue;
    }
    if (char === ")") {
      if (depth === 0) {
        return {
          path: unescapeMarkdownInline(src.slice(destinationStart, i).trim()),
          end: i + 1,
        };
      }
      depth--;
    }
  }
  return undefined;
}

function parseFileReferenceToken(src: string) {
  if (!src.startsWith("[") || src[1] === "$") {
    return undefined;
  }

  const labelEnd = findLinkLabelEnd(src);
  if (labelEnd <= 1) {
    return undefined;
  }

  const destination = parseMarkdownLinkDestination(src, labelEnd + 1);
  if (!destination) {
    return undefined;
  }

  const name = unescapeMarkdownInline(src.slice(1, labelEnd)).trim();
  const path = destination.path.trim();
  if (!isFileReference(name, path)) {
    return undefined;
  }

  return {
    raw: src.slice(0, destination.end),
    name,
    path,
  };
}

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
        name: "workspaceAgentTag",
        level: "inline",
        start(src: string) {
          return src.indexOf("[@");
        },
        tokenizer(src: string) {
          const match = /^\[@([^\]]+)\]\(agent:\/\/([^)]+)\)/.exec(src);
          if (match) {
            return {
              type: "workspaceAgentTag",
              raw: match[0],
              agentName: match[1],
              workspaceId: match[2],
            };
          }
          return undefined;
        },
        renderer(token: any) {
          const encodedAgentName = encodeData(token.agentName);
          const encodedWorkspaceId = encodeData(token.workspaceId);
          return `<span class="willow-workspace-agent-tag" data-agent-name="${encodedAgentName}" data-workspace-id="${encodedWorkspaceId}"></span>`;
        },
      },
      {
        name: "skillTag",
        level: "inline",
        start(src: string) {
          return src.indexOf("[$");
        },
        tokenizer(src: string) {
          const match = /^\[\$([^\]]+)\]\(([^)]+)\)/.exec(src);
          if (match) {
            return { type: "skillTag", raw: match[0], name: match[1], path: match[2] };
          }
          return undefined;
        },
        renderer(token: any) {
          const encodedName = encodeData(token.name);
          return `<span class="willow-skill-tag" data-name="${encodedName}"></span>`;
        },
      },
      {
        name: "fileTag",
        level: "inline",
        start(src: string) {
          return src.indexOf("[");
        },
        tokenizer(src: string) {
          const token = parseFileReferenceToken(src);
          if (!token) {
            return undefined;
          }
          return { type: "fileTag", raw: token.raw, name: token.name, path: token.path };
        },
        renderer(token: any) {
          const encodedName = encodeData(token.name);
          const encodedPath = encodeData(token.path);
          return `<span class="willow-file-tag" data-name="${encodedName}" data-path="${encodedPath}"></span>`;
        },
      },
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
    return `<div class="overflow-x-auto my-3">${table}</div>`;
  };

  let parsedContent = marked.parse(preservedContent, {
    async: false,
    renderer: renderer,
    breaks: true,
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
    ? "markdown-body markdown-content text-muted-foreground italic max-w-none break-words overflow-wrap-anywhere text-sm [&>*:last-child]:!mb-0"
    : "markdown-body markdown-content text-foreground max-w-none break-words overflow-wrap-anywhere [&>*:last-child]:!mb-0",
);

// We need to render CodeBlock components for any code blocks in the parsed HTML.
// Since v-html can't render Vue components, we use a post-mount approach
// with Teleport-like behavior via onMounted.
import { nextTick, onMounted, onUpdated, ref } from "vue";
import { createApp, h } from "vue";

const containerRef = ref<HTMLElement>();
const mountedApps: any[] = [];

function mountDynamicComponents() {
  if (!containerRef.value) return;

  for (const app of mountedApps) {
    app.unmount();
  }
  mountedApps.length = 0;

  for (const el of containerRef.value.querySelectorAll(".willow-code-block")) {
    const lang = el.getAttribute("data-lang") || "text";
    const code = el.getAttribute("data-code") || "";
    const app = createApp({
      render() {
        return h(CodeBlock, { code, language: lang });
      },
    });
    app.mount(el);
    mountedApps.push(app);
  }

  for (const el of containerRef.value.querySelectorAll(".willow-skill-tag")) {
    const encoded = el.getAttribute("data-name") || "";
    const name = decodeData(encoded);
    const app = createApp({
      render() {
        return h(SkillTag, { name });
      },
    });
    app.mount(el);
    mountedApps.push(app);
  }

  for (const el of containerRef.value.querySelectorAll(".willow-file-tag")) {
    const encodedName = el.getAttribute("data-name") || "";
    const encodedPath = el.getAttribute("data-path") || "";
    const name = decodeData(encodedName);
    const path = decodeData(encodedPath);
    const app = createApp({
      render() {
        return h(FileTag, { name, path });
      },
    });
    app.mount(el);
    mountedApps.push(app);
  }

  for (const el of containerRef.value.querySelectorAll(".willow-workspace-agent-tag")) {
    const encodedAgentName = el.getAttribute("data-agent-name") || "";
    const encodedWorkspaceId = el.getAttribute("data-workspace-id") || "";
    const agentName = decodeData(encodedAgentName);
    const workspaceId = Number(decodeData(encodedWorkspaceId)) || 0;
    const app = createApp({
      render() {
        return h(WorkspaceAgentTag, { agentName, workspaceId });
      },
    });
    app.mount(el);
    mountedApps.push(app);
  }
}

onMounted(() => {
  nextTick(mountDynamicComponents);
});

onUpdated(() => {
  nextTick(mountDynamicComponents);
});

import { onBeforeUnmount } from "vue";
onBeforeUnmount(() => {
  for (const app of mountedApps) {
    app.unmount();
  }
  mountedApps.length = 0;
});
</script>

<template>
  <div ref="containerRef" :class="containerClasses" v-html="renderedHtml"></div>
</template>
