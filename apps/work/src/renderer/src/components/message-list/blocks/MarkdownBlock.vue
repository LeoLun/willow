<script setup lang="ts">
import { ComarkRenderer, type ComarkTree } from "@comark/vue";
import highlight from "@comark/vue/plugins/highlight";
import math, { Math } from "@comark/vue/plugins/math";
import mermaid from "@comark/vue/plugins/mermaid";
import markdown from "@shikijs/langs/markdown";
import { createParse } from "comark";
import { onBeforeUnmount, shallowRef, watch } from "vue";
import { comarkSafety } from "./comark-safety";
import { createLatestTaskScheduler } from "./latest-task";
import MermaidDiagram from "./MermaidDiagram.vue";

interface Props {
  content: string;
  streaming?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  streaming: false,
});

const markdownOptions = {
  html: false,
};

const markdownComponents = {
  math: Math,
  mermaid: MermaidDiagram,
};

const markdownPlugins = [
  comarkSafety(),
  math(),
  mermaid(),
  highlight({
    languages: [markdown],
  }),
];

const parse = createParse({ ...markdownOptions, plugins: markdownPlugins });
const tree = shallowRef<ComarkTree>();
const scheduler = createLatestTaskScheduler({
  delayMs: 200,
  run: ({ content, streaming }: { content: string; streaming: boolean }) =>
    parse(content, { streaming }),
  onResult: (result) => {
    tree.value = result;
  },
  onError: (error) => {
    console.error("Markdown 解析失败:", error);
  },
});

watch(
  [() => props.content, () => props.streaming],
  ([content, streaming]) => scheduler.schedule({ content, streaming }, !streaming),
  { immediate: true },
);

onBeforeUnmount(() => scheduler.dispose());
</script>

<template>
  <div class="markdown markdown-new-styling min-w-0 break-words" data-slot="markdown-block">
    <div v-if="tree" :class="props.streaming ? 'comark-stream' : undefined">
      <Suspense>
        <ComarkRenderer
          :tree="tree"
          :components="markdownComponents"
          :streaming="props.streaming"
          :caret="props.streaming"
        />
      </Suspense>
    </div>
    <p v-else class="whitespace-pre-wrap">{{ props.content }}</p>
  </div>
</template>

<style>
.markdown-new-styling {
  max-width: unset;
  font-size: var(--text-sm);
  line-height: var(--text-line-height);
  color: var(--text-primary);
}

.markdown-new-styling pre:where(:not(.not-markdown *)) {
  margin-top: calc(var(--spacing) * 2);
}

.markdown-new-styling pre:where(:not(.not-markdown *)):first-child {
  margin-top: 0;
}

.markdown-new-styling :is(h1, h2, h3, h4, h5):where(:not(.not-markdown *)) {
  font-weight: var(--font-weight-semibold);
}

.markdown-new-styling h1:where(:not(.not-markdown *)) {
  margin-top: 0;
  margin-bottom: calc(var(--spacing) * 2);
  font-size: var(--text-2xl);
  line-height: var(--text-2xl--line-height);
  letter-spacing: var(--tracking-normal);
}

.markdown-new-styling h2:where(:not(.not-markdown *)) {
  margin-top: calc(var(--spacing) * 4);
  margin-bottom: var(--spacing);
  font-size: var(--text-xl);
  line-height: var(--text-xl--line-height);
}

.markdown-new-styling h3:where(:not(.not-markdown *)) {
  margin-top: calc(var(--spacing) * 4);
  margin-bottom: var(--spacing);
  font-size: var(--text-lg);
  line-height: var(--text-lg--line-height);
}

.markdown-new-styling :is(h2, h3, h4, h5):where(:not(.not-markdown *)):first-child {
  margin-top: 0;
}

.markdown-new-styling h4:where(:not(.not-markdown *)) {
  margin-top: calc(var(--spacing) * 4);
  margin-bottom: 0;
}

.markdown-new-styling h4 + p:where(:not(.not-markdown *)) {
  margin-top: 0;
}

.markdown-new-styling blockquote:where(:not(.not-markdown *)) {
  position: relative;
  margin-top: 0;
  margin-bottom: calc(var(--spacing) * 2);
  padding-block: calc(var(--spacing) * 2);
  padding-inline-start: calc(var(--spacing) * 6);
  border-width: 0;
  line-height: calc(var(--spacing) * 6);
}

.markdown-new-styling blockquote:where(:not(.not-markdown *)) > p {
  margin: 0;
  font-weight: var(--font-weight-normal);
}

.markdown-new-styling blockquote:where(:not(.not-markdown *)) > p::before,
.markdown-new-styling blockquote:where(:not(.not-markdown *)) > p::after {
  display: none;
}

.markdown-new-styling blockquote:where(:not(.not-markdown *))::after {
  position: absolute;
  top: calc(var(--spacing) * 2);
  bottom: calc(var(--spacing) * 2);
  inset-inline-start: 0;
  width: 4px;
  border-radius: 2px;
  background-color: color-mix(in oklab, currentColor 15%, transparent);
  content: "";
}

.markdown-new-styling p:where(:not(.not-markdown *)) {
  margin-block: var(--spacing);
}

.markdown-new-styling p:where(:not(.not-markdown *)):first-child {
  margin-top: 0;
}

.markdown-new-styling p + p:where(:not(.not-markdown *)) {
  margin-block: calc(var(--spacing) * 4);
}

.markdown-new-styling p + :where(ol, ul):where(:not(.not-markdown *)) {
  margin-top: 0;
}

.markdown-new-styling > :last-child:where(:not(.not-markdown *)) {
  margin-bottom: var(--spacing);
}

.markdown-new-styling :is(ul, ol):where(:not(.not-markdown *)) {
  margin: 0;
}

.markdown-new-styling
  :is(
    ul + h1,
    ul + h2,
    ul + h3,
    ul + h4,
    ul + h5,
    ul + h6,
    ol + h1,
    ol + h2,
    ol + h3,
    ol + h4,
    ol + h5,
    ol + h6
  ):where(:not(.not-markdown *)) {
  margin-top: calc(var(--spacing) * 4);
}

.markdown-new-styling :is(ul, ol):where(:not(.not-markdown *)) > li {
  margin-block: 0;
}

.markdown-new-styling :is(ul, ol):where(:not(.not-markdown *)) > li > :first-child {
  margin-top: 0;
  margin-bottom: 0;
}

.markdown-new-styling :is(ul, ol):where(:not(.not-markdown *)) > li > :last-child {
  margin-bottom: 0;
}

.markdown-new-styling li:where(:not(.not-markdown *))::marker {
  color: currentColor;
  font-weight: var(--font-weight-bold);
}

.markdown-new-styling a:where(:not(.not-markdown *)) {
  color: var(--primary);
  font-weight: var(--font-weight-normal);
  text-decoration-line: none;
}

@media (hover: hover) {
  .markdown-new-styling a:where(:not(.not-markdown *)):hover {
    color: color-mix(in oklab, var(--primary) 85%, var(--foreground));
  }
}

.markdown-new-styling strong:where(:not(.not-markdown *)) {
  font-weight: var(--font-weight-semibold);
}

.markdown-new-styling table:where(:not(.not-markdown *)) {
  margin: 0;
  border-collapse: separate;
  border-spacing: 0;
}

.markdown-new-styling th:where(:not(.not-markdown *)) {
  padding-block: calc(var(--spacing) * 2);
  border-bottom: 1px solid color-mix(in oklab, currentColor 15%, transparent);
  line-height: calc(var(--spacing) * 4);
}

.markdown-new-styling :is(th, td):where(:not(.not-markdown *)):not(:last-child) {
  padding-inline-end: calc(var(--spacing) * 6);
}

.markdown-new-styling :is(th, td):where(:not(.not-markdown *)):first-child {
  width: 1%;
  white-space: nowrap;
}

.markdown-new-styling tr:where(:not(.not-markdown *)):not(:last-child) td {
  border-bottom: 1px solid color-mix(in oklab, currentColor 5%, transparent);
}

.markdown-new-styling tr:where(:not(.not-markdown *)):last-child td {
  padding-bottom: calc(var(--spacing) * 6);
}

.markdown-new-styling td:where(:not(.not-markdown *)) {
  padding-block: calc(var(--spacing) * 2.5);
}

.markdown-new-styling hr + :where(:not(.not-markdown *)) {
  margin-top: 0;
}

.markdown-new-styling hr:where(:not(.not-markdown *)) {
  margin-block: calc(var(--spacing) * 7);
  border-color: color-mix(in oklab, currentColor 15%, transparent);
  clear: both;
}
</style>
