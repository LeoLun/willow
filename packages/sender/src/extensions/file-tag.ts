import { Node } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import FileTagView from "../components/FileTagView.vue";

export interface FileTagAttributes {
  name: string;
  path: string;
  relativePath: string;
  extension?: string;
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
    return node.attrs.name && node.attrs.path ? `[${node.attrs.name}](${node.attrs.path})` : "";
  },

  addNodeView() {
    return VueNodeViewRenderer(FileTagView as any);
  },
});
