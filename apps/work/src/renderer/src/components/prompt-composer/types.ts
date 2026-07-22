import type { ModelConfig } from "@shared/api";
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
  disabled?: boolean;
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
  approvalMode?: string;
  model?: ModelConfig;
  reasoningEffort?: string;
}

export interface ComposerInsertOptions {
  replaceTrigger?: boolean;
  trailingSpace?: boolean;
}

export type ComposerPanelType = "mention" | "slash";

export interface ComposerPanelSlotProps {
  query: string;
  insert: (text: string, options?: ComposerInsertOptions) => void;
  close: () => void;
}

export interface ComposerPanelKeydownPayload {
  type: ComposerPanelType;
  query: string;
  key: "ArrowDown" | "ArrowUp" | "Enter" | "Tab";
  event: KeyboardEvent;
}
