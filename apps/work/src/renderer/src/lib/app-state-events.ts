import type { WorkspaceInfo } from "@shared/api";

const providerConfigurationListeners = new Set<() => void>();
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
