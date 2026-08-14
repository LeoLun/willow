import type { TurnPlanArtifact, WorkspaceInfo } from "@shared/api";
import type { ComposerPromptTemplate } from "@/components/prompt-composer";

const providerConfigurationListeners = new Set<() => void>();
let pendingGuidedPrompt: ComposerPromptTemplate | undefined;
const workspaceCreatedListeners = new Set<(workspace: WorkspaceInfo) => void>();
const workspaceRenamedListeners = new Set<(workspace: WorkspaceInfo) => void>();
const planPreviewListeners = new Set<(plan: TurnPlanArtifact) => void>();

export function notifyProviderConfigurationChanged(): void {
  for (const listener of providerConfigurationListeners) listener();
}

export function onProviderConfigurationChanged(listener: () => void): () => void {
  providerConfigurationListeners.add(listener);
  return () => providerConfigurationListeners.delete(listener);
}

export function notifyWorkspaceCreated(workspace: WorkspaceInfo): void {
  for (const listener of workspaceCreatedListeners) listener(workspace);
}

export function onWorkspaceCreated(listener: (workspace: WorkspaceInfo) => void): () => void {
  workspaceCreatedListeners.add(listener);
  return () => workspaceCreatedListeners.delete(listener);
}

export function notifyWorkspaceRenamed(workspace: WorkspaceInfo): void {
  for (const listener of workspaceRenamedListeners) listener(workspace);
}

export function onWorkspaceRenamed(listener: (workspace: WorkspaceInfo) => void): () => void {
  workspaceRenamedListeners.add(listener);
  return () => workspaceRenamedListeners.delete(listener);
}

export function requestPlanPreview(plan: TurnPlanArtifact): void {
  for (const listener of planPreviewListeners) listener(plan);
}

export function onPlanPreviewRequested(listener: (plan: TurnPlanArtifact) => void): () => void {
  planPreviewListeners.add(listener);
  return () => planPreviewListeners.delete(listener);
}

/** 请求下次进入 home 页面时，在提示词输入框中载入引导模板。 */
export function requestGuidedPrompt(template: ComposerPromptTemplate): void {
  pendingGuidedPrompt = template;
}

/** 取出并清空待载入的引导提示词；没有待载入请求时返回 undefined。 */
export function consumeGuidedPrompt(): ComposerPromptTemplate | undefined {
  const template = pendingGuidedPrompt;
  pendingGuidedPrompt = undefined;
  return template;
}
