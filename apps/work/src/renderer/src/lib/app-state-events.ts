import type { WorkspaceInfo } from "@shared/api";
import type { ComposerPromptTemplate } from "@/components/prompt-composer";

const providerConfigurationListeners = new Set<() => void>();
let pendingGuidedPrompt: ComposerPromptTemplate | undefined;
const workspaceCreatedListeners = new Set<(workspace: WorkspaceInfo) => void>();

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
