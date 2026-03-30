import "./style.css";

// Components
export { default as MessageList } from "./components/MessageList.vue";
export { default as StreamingMessageContainer } from "./components/StreamingMessageContainer.vue";
export { default as UserMessage } from "./components/UserMessage.vue";
export { default as AssistantMessage } from "./components/AssistantMessage.vue";
export { default as ToolMessage } from "./components/ToolMessage.vue";
export { default as ToolMessageDebug } from "./components/ToolMessageDebug.vue";
export { default as ThinkingBlock } from "./components/ThinkingBlock.vue";
export { default as ConsoleBlock } from "./components/ConsoleBlock.vue";
export { default as MarkdownBlock } from "./components/MarkdownBlock.vue";
export { default as CodeBlock } from "./components/CodeBlock.vue";
export { default as AttachmentTile } from "./components/AttachmentTile.vue";

// Tool renderer system
export { registerToolRenderer, getToolRenderer, renderTool } from "./renderers/registry";
export type { ToolRenderer, ToolRenderResult } from "./renderers/types";

// Message renderer registry
export {
  registerMessageRenderer,
  getMessageRenderer,
  renderMessage,
} from "./utils/message-renderer";
export type { MessageRenderer, MessageRole } from "./utils/message-renderer";

// Utilities
export { formatUsage, formatCost, formatTokenCount } from "./utils/format";
export { i18n, setLanguage } from "./utils/i18n";

// Types
export type { Attachment } from "./types";
export type { UserMessageWithAttachments, ArtifactMessage } from "./types";
