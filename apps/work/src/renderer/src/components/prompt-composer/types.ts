import type { AgentMode, LocalFileAttachment, ModelConfig, PermissionMode } from "@shared/api";
import type { Component } from "vue";

export type ComposerSegment =
  | { type: "text"; content: string }
  | {
      type: "token";
      ruleId: string;
      source: string;
      component: Component;
      props: Record<string, unknown>;
    };

export interface ComposerTokenRule {
  id: string;
  pattern: RegExp;
  component: Component;
  createProps(match: RegExpMatchArray): Record<string, unknown>;
}

export interface ComposerOption {
  value: string;
  label: string;
  icon?: Component;
  disabled?: boolean;
}

export interface ComposerTemplateOption {
  label: string;
  value: string;
}

export type ComposerTemplateSegment =
  | { type: "text"; content: string }
  | { type: "input"; placeholder: string }
  | {
      type: "select";
      placeholder: string;
      options: ComposerTemplateOption[];
    };

export interface ComposerPromptTemplate {
  segments: ComposerTemplateSegment[];
}

export interface ComposerModelOption {
  value: ModelConfig;
  label: string;
  group?: string;
  disabled?: boolean;
  reasoningEfforts: ComposerOption[];
  defaultReasoningEffort?: string;
}

export interface ComposerSubmitPayload {
  content: string;
  attachments: LocalFileAttachment[];
  approvalMode?: PermissionMode;
  model?: ModelConfig;
  agentMode?: AgentMode;
  reasoningEffort?: string;
}

export interface ComposerInsertOptions {
  replaceTrigger?: boolean;
  trailingSpace?: boolean;
}

export type ComposerPanelType = "mention" | "slash";
export type ComposerPanelNavigationKey = "ArrowDown" | "ArrowUp" | "Enter";

export interface ComposerPanelSlotProps {
  query: string;
  insert: (text: string, options?: ComposerInsertOptions) => void;
  close: () => void;
}

export interface ComposerPanelKeydownPayload {
  type: ComposerPanelType;
  query: string;
  key: ComposerPanelNavigationKey;
  event: KeyboardEvent;
}

export interface ComposerPanelNavigationHandle {
  handlePanelKeydown(key: ComposerPanelNavigationKey): void;
}

export interface ComposerHandle {
  replaceContentAndFocus(content: string): Promise<void>;
  loadTemplateAndFocus(template: ComposerPromptTemplate): Promise<void>;
}
