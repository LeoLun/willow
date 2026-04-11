import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import AutomationCreateToolRenderer from "./AutomationCreateToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

interface AutomationCreateRendererOptions {
  onOpen?: () => void | Promise<void>;
}

export class AutomationCreateRendererFactory implements ToolRenderer {
  constructor(private readonly options: AutomationCreateRendererOptions = {}) {}

  render(
    params: unknown,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
  ): ToolRenderResult {
    return {
      component: markRaw(AutomationCreateToolRenderer),
      props: {
        params,
        result,
        isStreaming,
        onOpen: this.options.onOpen,
      },
      isCustom: true,
    };
  }
}
