import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { markRaw } from "vue";
import type { ToolRenderer, ToolRenderResult } from "./types";
import WorkspaceDelegateToolRenderer from "./WorkspaceDelegateToolRenderer.vue";

interface WorkspaceDelegateRendererOptions {
  onNavigateToSession?: (childSessionId: number) => void | Promise<void>;
  onGetSessionHistory?: (sessionId: number) => Promise<any>;
  onSubscribeSessionUpdate?: (sessionId: number, callback: (event: any) => void) => () => void;
}

export class WorkspaceDelegateRendererFactory implements ToolRenderer {
  constructor(private readonly options: WorkspaceDelegateRendererOptions = {}) {}

  render(
    params: unknown,
    result: ToolResultMessage | undefined,
    isStreaming?: boolean,
  ): ToolRenderResult {
    return {
      component: markRaw(WorkspaceDelegateToolRenderer),
      props: {
        params,
        result,
        isStreaming,
        onNavigateToSession: this.options.onNavigateToSession,
        onGetSessionHistory: this.options.onGetSessionHistory,
        onSubscribeSessionUpdate: this.options.onSubscribeSessionUpdate,
      },
      isCustom: true,
    };
  }
}
