<script setup lang="ts">
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { watch } from "vue";
import { SkillTag } from "../extensions/skill-tag";
import type { SkillTagAttributes } from "../extensions/skill-tag";

const props = withDefaults(
  defineProps<{
    modelValue?: string;
    onKeyDown?: (event: KeyboardEvent) => boolean;
  }>(),
  {
    modelValue: "",
    onKeyDown: undefined,
  },
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
  "editor-update": [];
  "editor-selection-update": [];
}>();

const editor = useEditor({
  extensions: [
    StarterKit.configure({
      blockquote: false,
      bulletList: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      heading: false,
      horizontalRule: false,
      orderedList: false,
    }),
    SkillTag,
  ],
  content: props.modelValue,
  autofocus: false,
  onUpdate: ({ editor }) => {
    emit("update:modelValue", editor.getText());
    emit("editor-update");
  },
  onSelectionUpdate: () => {
    emit("editor-selection-update");
  },
  editorProps: {
    attributes: {
      class: "sender-editor-content",
    },
    handleKeyDown: (_view, event) => {
      if (props.onKeyDown?.(event)) {
        return true;
      }
    },
  },
});

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) return;
    const currentText = editor.value.getText();
    if (value === currentText) return;
    editor.value.commands.setContent(value || "");
  },
);

function insertSkillTag(attrs: SkillTagAttributes) {
  if (!editor.value) return;
  editor.value
    .chain()
    .focus()
    .insertContent([
      { type: "skillTag", attrs },
      { type: "text", text: " " },
    ])
    .run();
}

function getSkillTags(): SkillTagAttributes[] {
  if (!editor.value) return [];
  const tags: SkillTagAttributes[] = [];
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === "skillTag") {
      tags.push({
        name: node.attrs.name,
        filePath: node.attrs.filePath,
        scope: node.attrs.scope,
        scopeLabel: node.attrs.scopeLabel,
      });
    }
  });
  return tags;
}

defineExpose({ editor, insertSkillTag, getSkillTags });
</script>

<template>
  <EditorContent :editor="editor" class="text-base text-foreground" />
</template>
<style scoped>
:deep(.ProseMirror.sender-editor-content) {
  min-height: 3rem;
  max-height: 10.5rem;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
  outline: none;
}
</style>
