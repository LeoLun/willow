import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import DefaultToolRenderer from "./DefaultToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class DefaultRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(DefaultToolRenderer),
      props: { params, result, isStreaming, toolName },
      isCustom: false,
    };
  }
}
