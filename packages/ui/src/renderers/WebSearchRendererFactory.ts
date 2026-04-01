import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import type { ToolRenderer, ToolRenderResult } from "./types";
import WebSearchToolRenderer from "./WebSearchToolRenderer.vue";

export class WebSearchRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(WebSearchToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
