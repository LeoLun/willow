import { Node } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import FileTagView from "../components/FileTagView.vue";

export interface FileTagAttributes {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
}

function escapeMarkdownLinkLabel(value: string) {
  return value.replace(/([\\\]])/g, "\\$1");
}

function escapeMarkdownLinkDestination(value: string) {
  return value.replace(/([\\>])/g, "\\$1");
}

export const FileTag = Node.create({
  name: "fileTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      name: { default: "" },
      path: { default: "" },
      relativePath: { default: "" },
      extension: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-file-tag="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-file-tag": "true",
        "data-name": HTMLAttributes.name,
        "data-path": HTMLAttributes.path,
        "data-relative-path": HTMLAttributes.relativePath,
        "data-extension": HTMLAttributes.extension,
      },
    ];
  },

  renderText({ node }) {
    if (!node.attrs.name || !node.attrs.path) {
      return "";
    }
    const name = escapeMarkdownLinkLabel(node.attrs.name);
    const path = escapeMarkdownLinkDestination(node.attrs.path);
    return `[${name}](<${path}>)`;
  },

  addNodeView() {
    return VueNodeViewRenderer(FileTagView as any);
  },
});
