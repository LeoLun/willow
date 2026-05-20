import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { AutomationCreateRendererFactory } from "./AutomationCreateRendererFactory";
import { AutomationDeleteRendererFactory } from "./AutomationDeleteRendererFactory";
import { AutomationGetListRendererFactory } from "./AutomationGetListRendererFactory";
import { AutomationGetRendererFactory } from "./AutomationGetRendererFactory";
import { AutomationUpdateRendererFactory } from "./AutomationUpdateRendererFactory";
import { BashRendererFactory } from "./BashRendererFactory";
import { DefaultRendererFactory } from "./DefaultRendererFactory";
import { TodoRendererFactory } from "./TodoRendererFactory";
import type { ToolRenderer, ToolRenderResult } from "./types";
import { WebFetchRendererFactory } from "./WebFetchRendererFactory";
import { WebSearchRendererFactory } from "./WebSearchRendererFactory";
import { WorkspaceDelegateRendererFactory } from "./WorkspaceDelegateRendererFactory";

const toolRenderers = new Map<string, ToolRenderer>();

export function registerToolRenderer(toolName: string, renderer: ToolRenderer): void {
  toolRenderers.set(toolName, renderer);
}

export function getToolRenderer(toolName: string): ToolRenderer | undefined {
  return toolRenderers.get(toolName);
}

const defaultRenderer = new DefaultRendererFactory();

let showJsonMode = false;

function normalizeToolName(name: string): string {
  const lowered = name.toLowerCase();
  const bySplit = lowered.split(/[/:.]/).filter(Boolean).pop() || lowered;
  return bySplit.replace(/[-_](tool|file)$/g, "").replace(/[-_]/g, "");
}

export function setShowJsonMode(enabled: boolean): void {
  showJsonMode = enabled;
}

export function renderTool(
  toolName: string,
  params: any | undefined,
  result: ToolResultMessage | undefined,
  isStreaming?: boolean,
): ToolRenderResult {
  if (showJsonMode) {
    return defaultRenderer.render(params, result, isStreaming, toolName);
  }

  const renderer = getToolRenderer(toolName) ?? getToolRenderer(normalizeToolName(toolName));
  if (renderer) {
    return renderer.render(params, result, isStreaming, toolName);
  }
  return defaultRenderer.render(params, result, isStreaming, toolName);
}

export function registryAllToolRenderers(options: {
  onOpenUrl?: (url: string) => void | Promise<void>;
  onOpenAutomation?: (automation: any) => void | Promise<void>;
  onNavigateToSession?: (childSessionId: number) => void | Promise<void>;
  onGetSessionHistory?: (sessionId: number) => Promise<any>;
  onSubscribeSessionUpdate?: (sessionId: number, callback: (event: any) => void) => () => void;
}): void {
  console.log("registryAllToolRenderers", options.onOpenUrl, options.onOpenAutomation);
  registerToolRenderer("bash", new BashRendererFactory());
  registerToolRenderer("webfetch", new WebFetchRendererFactory());
  registerToolRenderer("web_fetch", new WebFetchRendererFactory());
  registerToolRenderer("websearch", new WebSearchRendererFactory({ onOpenUrl: options.onOpenUrl }));
  registerToolRenderer(
    "web_search",
    new WebSearchRendererFactory({ onOpenUrl: options.onOpenUrl }),
  );
  registerToolRenderer(
    "automation_create",
    new AutomationCreateRendererFactory({
      onOpenAutomation: options.onOpenAutomation,
    }),
  );

  registerToolRenderer("automation_delete", new AutomationDeleteRendererFactory());
  registerToolRenderer("automation_list", new AutomationGetListRendererFactory());
  registerToolRenderer("automation_get", new AutomationGetRendererFactory());
  registerToolRenderer("automation_update", new AutomationUpdateRendererFactory());
  registerToolRenderer("todoread", new TodoRendererFactory());
  registerToolRenderer("todowrite", new TodoRendererFactory());
  registerToolRenderer(
    "workspace_delegate",
    new WorkspaceDelegateRendererFactory({
      onNavigateToSession: options.onNavigateToSession,
      onGetSessionHistory: options.onGetSessionHistory,
      onSubscribeSessionUpdate: options.onSubscribeSessionUpdate,
    }),
  );
}
