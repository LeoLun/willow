import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import type { ToolRenderer, ToolRenderResult } from "./types";
import WebFetchToolRenderer from "./WebFetchToolRenderer.vue";

export class WebFetchRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(WebFetchToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
