<script setup lang="ts">
import { Comark } from "@comark/vue";
import highlight from "@comark/vue/plugins/highlight";
import math, { Math } from "@comark/vue/plugins/math";
import mermaid from "@comark/vue/plugins/mermaid";
import markdown from "@shikijs/langs/markdown";
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
  math(),
  mermaid(),
  highlight({
    languages: [markdown],
  }),
];
</script>

<template>
  <div class="markdown markdown-new-styling min-w-0 break-words" data-slot="markdown-block">
    <Suspense>
      <Comark
        :markdown="props.content"
        :options="markdownOptions"
        :components="markdownComponents"
        :plugins="markdownPlugins"
        :streaming="props.streaming"
        :caret="props.streaming"
      />

      <template #fallback>
        <p class="whitespace-pre-wrap">{{ props.content }}</p>
      </template>
    </Suspense>
  </div>
</template>

<style>
.markdown-new-styling {
  --spacing: 0.25rem;
  --text-lg: 1.125rem;
  --text-lg--line-height: calc(1.75 / 1.125);
  --text-xl: 1.25rem;
  --text-xl--line-height: calc(1.75 / 1.25);
  --text-2xl: 1.5rem;
  --text-2xl--line-height: calc(2 / 1.5);
  --tracking-normal: 0em;
  --font-weight-semibold: 600;
  --border-medium: rgb(0 0 0 / 15%);
}

.dark .markdown-new-styling {
  --border-medium: rgb(255 255 255 / 15%);
}

.markdown-new-styling :is(.markdown h1:where(:not(.not-markdown *))) {
  margin-bottom: calc(var(--spacing) * 2);
  font-size: var(--text-2xl);
  line-height: var(--tw-leading, var(--text-2xl--line-height));
  --tw-tracking: var(--tracking-normal);
  letter-spacing: var(--tracking-normal);
}

.markdown-new-styling :is(.markdown h2:where(:not(.not-markdown *))) {
  margin-top: calc(var(--spacing) * 4);
  margin-bottom: var(--spacing);
  font-size: var(--text-xl);
  line-height: var(--tw-leading, var(--text-xl--line-height));
}

.markdown-new-styling :is(.markdown h3:where(:not(.not-markdown *))) {
  margin-top: calc(var(--spacing) * 4);
  margin-bottom: var(--spacing);
  font-size: var(--text-lg);
  line-height: var(--tw-leading, var(--text-lg--line-height));
}

.markdown-new-styling :is(.markdown h4:where(:not(.not-markdown *))) {
  margin-bottom: 0;
}

.markdown-new-styling :is(.markdown h4 + p:where(:not(.not-markdown *))) {
  margin-top: 0;
}

.markdown-new-styling :is(.markdown blockquote:where(:not(.not-markdown *))) {
  margin-top: 0;
  margin-bottom: calc(var(--spacing) * 2);
}

.markdown-new-styling :is(.markdown p:where(:not(.not-markdown *))) {
  margin-block: var(--spacing);
}

.markdown-new-styling :is(.markdown p:where(:not(.not-markdown *))):first-child {
  margin-top: 0;
}

.markdown-new-styling :is(.markdown p + p:where(:not(.not-markdown *))) {
  margin-block: calc(var(--spacing) * 4);
}

.markdown.markdown-new-styling > :last-child:where(:not(.not-markdown *)) {
  margin-bottom: calc(var(--spacing) * 1);
}

.markdown-new-styling
  :is(.markdown ul:where(:not(.not-markdown *)), .markdown ol:where(:not(.not-markdown *))) {
  margin: 0;
}

.markdown-new-styling
  :is(
    .markdown ul + h1:where(:not(.not-markdown *)),
    .markdown ul + h2:where(:not(.not-markdown *)),
    .markdown ul + h3:where(:not(.not-markdown *)),
    .markdown ul + h4:where(:not(.not-markdown *)),
    .markdown ul + h5:where(:not(.not-markdown *)),
    .markdown ul + h6:where(:not(.not-markdown *)),
    .markdown ol + h1:where(:not(.not-markdown *)),
    .markdown ol + h2:where(:not(.not-markdown *)),
    .markdown ol + h3:where(:not(.not-markdown *)),
    .markdown ol + h4:where(:not(.not-markdown *)),
    .markdown ol + h5:where(:not(.not-markdown *)),
    .markdown ol + h6:where(:not(.not-markdown *))
  ) {
  margin-top: calc(var(--spacing) * 4);
}

.markdown-new-styling
  :is(.markdown ul li:where(:not(.not-markdown *)), .markdown ol li:where(:not(.not-markdown *))) {
  margin-block: 0;
}

.markdown-new-styling :is(.markdown strong:where(:not(.not-markdown *))) {
  --tw-font-weight: var(--font-weight-semibold);
  font-weight: var(--font-weight-semibold);
}

.markdown-new-styling :is(.markdown hr + :where(:not(.not-markdown *))) {
  margin-top: 0;
}

.markdown-new-styling :is(.markdown hr:where(:not(.not-markdown *))) {
  margin-block: calc(var(--spacing) * 7);
  border-color: var(--border-medium);
}
</style>
