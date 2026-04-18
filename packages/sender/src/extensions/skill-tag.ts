import { Node } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import SkillTagView from "../components/SkillTagView.vue";
import type { SenderSkillScope } from "../types";

export interface SkillTagAttributes {
  name: string;
  filePath: string;
  scope: SenderSkillScope;
  scopeLabel: string;
}

export const SkillTag = Node.create({
  name: "skillTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      name: { default: "" },
      filePath: { default: "" },
      scope: { default: "global" },
      scopeLabel: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-skill-tag="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-skill-tag": "true",
        "data-name": HTMLAttributes.name,
        "data-file-path": HTMLAttributes.filePath,
        "data-scope": HTMLAttributes.scope,
        "data-scope-label": HTMLAttributes.scopeLabel,
      },
    ];
  },

  renderText() {
    return "";
  },

  addNodeView() {
    return VueNodeViewRenderer(SkillTagView);
  },
});
