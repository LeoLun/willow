<script setup lang="ts">
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { computed, watch } from "vue";
import { parseMarkdownToTiptapContent, serializeTiptapDocToMarkdown } from "../markdown";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    placeholder?: string;
    disabled?: boolean;
    autofocus?: boolean;
  }>(),
  {
    modelValue: "",
    placeholder: "输入 Markdown 内容",
    disabled: false,
    autofocus: false,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
    }),
    Placeholder.configure({
      placeholder: () => props.placeholder,
    }),
  ],
  autofocus: props.autofocus,
  editable: !props.disabled,
  content: "",
  onCreate: ({ editor }) => {
    editor.commands.setContent(parseMarkdownToTiptapContent(props.modelValue, editor.schema), {
      emitUpdate: false,
    });
  },
  onUpdate: ({ editor }) => {
    emit("update:modelValue", serializeTiptapDocToMarkdown(editor.state.doc));
  },
  editorProps: {
    attributes: {
      class: "willow-md-editor-content",
    },
  },
});

const editorClass = computed(() => ({
  "is-disabled": props.disabled,
}));

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) {
      return;
    }

    const currentValue = serializeTiptapDocToMarkdown(editor.value.state.doc);

    if (value === currentValue) {
      return;
    }

    editor.value.commands.setContent(
      parseMarkdownToTiptapContent(value || "", editor.value.schema),
      {
        emitUpdate: false,
      },
    );
  },
);

watch(
  () => props.disabled,
  (disabled) => {
    editor.value?.setEditable(!disabled);
  },
);
</script>

<template>
  <EditorContent :editor="editor" :class="editorClass" />
</template>

<style scoped>
:deep(.ProseMirror.willow-md-editor-content) {
  min-height: 320px;
  width: 100%;
  color: var(--color-foreground);
  font-size: 1rem;
  line-height: 1.8;
  outline: none;
  overflow-wrap: anywhere;
  white-space: pre-wrap;
}

:deep(.ProseMirror.willow-md-editor-content p) {
  margin: 0.45rem 0;
}

:deep(.ProseMirror.willow-md-editor-content h1),
:deep(.ProseMirror.willow-md-editor-content h2),
:deep(.ProseMirror.willow-md-editor-content h3),
:deep(.ProseMirror.willow-md-editor-content h4),
:deep(.ProseMirror.willow-md-editor-content h5),
:deep(.ProseMirror.willow-md-editor-content h6) {
  margin: 0.85rem 0 0.45rem;
  color: var(--color-foreground);
  font-weight: 650;
  line-height: 1.25;
}

:deep(.ProseMirror.willow-md-editor-content h1) {
  font-size: 1.65rem;
}

:deep(.ProseMirror.willow-md-editor-content h2) {
  font-size: 1.35rem;
}

:deep(.ProseMirror.willow-md-editor-content h3) {
  font-size: 1.15rem;
}

:deep(.ProseMirror.willow-md-editor-content h4),
:deep(.ProseMirror.willow-md-editor-content h5),
:deep(.ProseMirror.willow-md-editor-content h6) {
  font-size: 1rem;
}

:deep(.ProseMirror.willow-md-editor-content ul),
:deep(.ProseMirror.willow-md-editor-content ol) {
  margin: 0.55rem 0;
  padding-left: 1.4rem;
}

:deep(.ProseMirror.willow-md-editor-content li) {
  margin: 0.2rem 0;
}

:deep(.ProseMirror.willow-md-editor-content blockquote) {
  margin: 0.75rem 0;
  border-left: 2px solid var(--color-border);
  padding-left: 0.85rem;
  color: var(--color-muted-foreground);
}

:deep(.ProseMirror.willow-md-editor-content pre) {
  margin: 0.85rem 0;
  border: 1px solid var(--color-border);
  border-radius: calc(var(--radius) - 2px);
  background: var(--color-muted);
  padding: 0.85rem 1rem;
  color: var(--color-foreground);
  font-size: 0.9rem;
  line-height: 1.65;
  overflow-x: auto;
  white-space: pre;
}

:deep(.ProseMirror.willow-md-editor-content code) {
  border-radius: calc(var(--radius) - 4px);
  background: var(--color-muted);
  padding: 0.1rem 0.25rem;
  font-size: 0.92em;
}

:deep(.ProseMirror.willow-md-editor-content pre code) {
  border-radius: 0;
  background: transparent;
  padding: 0;
  font-size: inherit;
}

:deep(.ProseMirror.willow-md-editor-content p.is-editor-empty:first-child::before),
:deep(.ProseMirror.willow-md-editor-content p.is-empty::before) {
  color: var(--color-muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

.is-disabled :deep(.ProseMirror.willow-md-editor-content) {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
