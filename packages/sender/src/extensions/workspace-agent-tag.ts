import { Node } from "@tiptap/core";
import { VueNodeViewRenderer } from "@tiptap/vue-3";
import WorkspaceAgentTagView from "../components/WorkspaceAgentTagView.vue";

export interface WorkspaceAgentTagAttributes {
  workspaceId: number;
  workspaceName: string;
  agentName: string;
  agentDescription: string;
}

export const WorkspaceAgentTag = Node.create({
  name: "workspaceAgentTag",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      workspaceId: { default: 0 },
      workspaceName: { default: "" },
      agentName: { default: "" },
      agentDescription: { default: "" },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-workspace-agent-tag="true"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      {
        "data-workspace-agent-tag": "true",
        "data-workspace-id": HTMLAttributes.workspaceId,
        "data-workspace-name": HTMLAttributes.workspaceName,
        "data-agent-name": HTMLAttributes.agentName,
        "data-agent-description": HTMLAttributes.agentDescription,
      },
    ];
  },

  renderText({ node }) {
    if (!node.attrs.agentName || !node.attrs.workspaceId) {
      return "";
    }
    return `[@${node.attrs.agentName}](agent://${node.attrs.workspaceId})`;
  },

  addNodeView() {
    return VueNodeViewRenderer(WorkspaceAgentTagView as any);
  },
});
