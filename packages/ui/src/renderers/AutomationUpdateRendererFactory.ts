import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import AutomationUpdateToolRenderer from "./AutomationUpdateToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class AutomationUpdateRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(AutomationUpdateToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
