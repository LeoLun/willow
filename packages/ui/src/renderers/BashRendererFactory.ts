import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import BashToolRenderer from "./BashToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class BashRendererFactory implements ToolRenderer<{ command: string }> {
  render(
    params: { command: string } | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(BashToolRenderer),
      props: { params, result, isStreaming },
      isCustom: false,
    };
  }
}
