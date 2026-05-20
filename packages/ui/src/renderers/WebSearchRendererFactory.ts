import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import type { ToolRenderer, ToolRenderResult } from "./types";
import WebSearchToolRenderer from "./WebSearchToolRenderer.vue";

interface WebSearchRendererOptions {
  onOpenUrl?: (url: string) => void | Promise<void>;
}

export class WebSearchRendererFactory implements ToolRenderer {
  constructor(private readonly options: WebSearchRendererOptions = {}) {}

  render(
    params: any | undefined,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    _toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(WebSearchToolRenderer),
      props: { params, result, isStreaming, onOpenUrl: this.options.onOpenUrl },
      isCustom: false,
    };
  }
}
