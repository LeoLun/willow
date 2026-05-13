import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import CoreToolRenderer from "./CoreToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class CoreToolRendererFactory implements ToolRenderer {
  constructor(private readonly toolName: string) {}

  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(CoreToolRenderer),
      props: {
        toolName: this.toolName,
        params,
        result,
        isStreaming,
      },
      isCustom: false,
    };
  }
}
