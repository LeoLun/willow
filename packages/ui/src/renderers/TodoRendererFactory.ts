import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import TodoToolRenderer from "./TodoToolRenderer.vue";
import type { ToolRenderer, ToolRenderResult } from "./types";

export class TodoRendererFactory implements ToolRenderer {
  render(
    params: unknown,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
    toolName?: string,
  ): ToolRenderResult {
    return {
      component: markRaw(TodoToolRenderer),
      props: {
        toolName,
        params,
        result,
        isStreaming,
      },
      isCustom: true,
    };
  }
}
