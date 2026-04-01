import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { BashRendererFactory } from "./BashRendererFactory";
import { DefaultRendererFactory } from "./DefaultRendererFactory";
import type { ToolRenderer, ToolRenderResult } from "./types";
import { WebFetchRendererFactory } from "./WebFetchRendererFactory";
import { WebSearchRendererFactory } from "./WebSearchRendererFactory";

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
  return bySplit.replace(/[-_](tool|file)$/g, "");
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

// Register built-in renderers
registerToolRenderer("bash", new BashRendererFactory());
registerToolRenderer("webfetch", new WebFetchRendererFactory());
registerToolRenderer("websearch", new WebSearchRendererFactory());
