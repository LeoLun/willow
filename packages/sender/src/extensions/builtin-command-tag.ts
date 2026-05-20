import { Node } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import BuiltinCommandTagView from "../components/BuiltinCommandTagView.vue";

export interface BuiltinCommandTagAttributes {
  id: string;
  name: string;
  description: string;
}

export const BuiltinCommandTag = Node.create({
  name: "builtinCommandTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      id: { default: "" },
      name: { default: "" },
      description: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-builtin-command-tag="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-builtin-command-tag": "true",
        "data-id": HTMLAttributes.id,
        "data-name": HTMLAttributes.name,
        "data-description": HTMLAttributes.description,
      },
    ];
  },

  renderText({ node }) {
    return node.attrs.name || "";
  },

  addNodeView() {
    return VueNodeViewRenderer(BuiltinCommandTagView as any);
  },
});
