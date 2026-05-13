import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import AutomationDeleteToolRenderer from "./AutomationDeleteToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class AutomationDeleteRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(AutomationDeleteToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
