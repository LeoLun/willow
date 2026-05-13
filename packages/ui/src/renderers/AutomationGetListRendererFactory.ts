import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import AutomationGetListToolRenderer from "./AutomationGetListToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class AutomationGetListRendererFactory implements ToolRenderer {
  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(AutomationGetListToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
