import type { ToolResultMessage } from "@mariozechner/pi-ai";
import type { Component } from "vue";

export interface ToolRenderResult {
  component: Component;
  props: Record<string, any>;
  isCustom: boolean;
}

export interface ToolRenderer<TParams = any, TDetails = any> {
  render(
    params: TParams | undefined,
    result: ToolResultMessage<TDetails> | undefined,
    isStreaming?: boolean,
    toolName?: string,
  ): ToolRenderResult;
}
