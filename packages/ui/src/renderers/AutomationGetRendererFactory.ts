import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import AutomationGetToolRenderer from "./AutomationGetToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class AutomationGetRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(AutomationGetToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
