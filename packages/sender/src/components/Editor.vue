<script setup lang="ts">
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor } from "@tiptap/vue-3";
import { watch } from "vue";
import { BuiltinCommandTag } from "../extensions/builtin-command-tag";
import type { BuiltinCommandTagAttributes } from "../extensions/builtin-command-tag";
import { FileTag } from "../extensions/file-tag";
import type { FileTagAttributes } from "../extensions/file-tag";
import { SkillTag } from "../extensions/skill-tag";
import type { SkillTagAttributes } from "../extensions/skill-tag";
import { WorkspaceAgentTag } from "../extensions/workspace-agent-tag";
import type { WorkspaceAgentTagAttributes } from "../extensions/workspace-agent-tag";

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
    Placeholder.configure({
      placeholder: "向 AI 提问，/ 选择技能或文件",
    }),
    BuiltinCommandTag,
    FileTag,
    SkillTag,
    WorkspaceAgentTag,
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

function insertBuiltinCommandTag(attrs: BuiltinCommandTagAttributes) {
  if (!editor.value) return;
  clearBuiltinCommandTags();
  editor.value
    .chain()
    .focus()
    .insertContent([
      { type: "builtinCommandTag", attrs },
      { type: "text", text: " " },
    ])
    .run();
}

function insertWorkspaceAgentTag(attrs: WorkspaceAgentTagAttributes) {
  if (!editor.value) return;
  clearWorkspaceAgentTags();
  editor.value
    .chain()
    .focus()
    .insertContent([
      { type: "workspaceAgentTag", attrs },
      { type: "text", text: " " },
    ])
    .run();
}

function insertFileTag(attrs: FileTagAttributes) {
  if (!editor.value) return;
  editor.value
    .chain()
    .focus()
    .insertContent([
      { type: "fileTag", attrs },
      { type: "text", text: " " },
    ])
    .run();
}

function getWorkspaceAgentTags(): WorkspaceAgentTagAttributes[] {
  if (!editor.value) return [];
  const tags: WorkspaceAgentTagAttributes[] = [];
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === "workspaceAgentTag") {
      tags.push({
        workspaceId: Number(node.attrs.workspaceId) || 0,
        workspaceName: node.attrs.workspaceName,
        agentName: node.attrs.agentName,
        agentDescription: node.attrs.agentDescription,
      });
    }
  });
  return tags;
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

function getFileTags(): FileTagAttributes[] {
  if (!editor.value) return [];
  const tags: FileTagAttributes[] = [];
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === "fileTag") {
      tags.push({
        name: node.attrs.name,
        path: node.attrs.path,
        relativePath: node.attrs.relativePath,
        extension: node.attrs.extension || undefined,
      });
    }
  });
  return tags;
}

function getBuiltinCommandTags(): BuiltinCommandTagAttributes[] {
  if (!editor.value) return [];
  const tags: BuiltinCommandTagAttributes[] = [];
  editor.value.state.doc.descendants((node) => {
    if (node.type.name === "builtinCommandTag") {
      tags.push({
        id: node.attrs.id,
        name: node.attrs.name,
        description: node.attrs.description,
      });
    }
  });
  return tags;
}

function clearBuiltinCommandTags() {
  if (!editor.value) return;

  const ranges: Array<{ from: number; to: number }> = [];
  editor.value.state.doc.descendants((node, pos) => {
    if (node.type.name === "builtinCommandTag") {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  if (ranges.length === 0) {
    return;
  }

  let chain = editor.value.chain().focus();
  for (const range of ranges.reverse()) {
    chain = chain.deleteRange(range);
  }
  chain.run();
}

function clearWorkspaceAgentTags() {
  if (!editor.value) return;

  const ranges: Array<{ from: number; to: number }> = [];
  editor.value.state.doc.descendants((node, pos) => {
    if (node.type.name === "workspaceAgentTag") {
      ranges.push({ from: pos, to: pos + node.nodeSize });
    }
  });

  if (ranges.length === 0) {
    return;
  }

  let chain = editor.value.chain().focus();
  for (const range of ranges.reverse()) {
    chain = chain.deleteRange(range);
  }
  chain.run();
}

function getTextWithoutFileTags(): string {
  if (!editor.value) return "";
  const parts: string[] = [];
  editor.value.state.doc.descendants((node) => {
    if (node.isText) {
      parts.push(node.text ?? "");
      return;
    }
    if (node.type.name === "builtinCommandTag") {
      return;
    }
    if (node.type.name === "workspaceAgentTag") {
      return;
    }
    if (node.type.name === "skillTag") {
      parts.push(node.attrs.name ? `[$${node.attrs.name}](${node.attrs.filePath})` : "");
    }
  });
  return parts.join("");
}

function clear() {
  if (!editor.value) return;
  editor.value.commands.setContent("");
}

defineExpose({
  editor,
  insertBuiltinCommandTag,
  insertWorkspaceAgentTag,
  insertSkillTag,
  insertFileTag,
  getBuiltinCommandTags,
  getWorkspaceAgentTags,
  getSkillTags,
  getFileTags,
  clearBuiltinCommandTags,
  clearWorkspaceAgentTags,
  getTextWithoutFileTags,
  clear,
});
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

:deep(.ProseMirror.sender-editor-content p.is-editor-empty:first-child::before) {
  color: var(--color-muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

:deep(.ProseMirror.sender-editor-content p.is-empty::before) {
  color: var(--color-muted-foreground);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}
</style>
