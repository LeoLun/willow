import type { ProviderInfo } from "@shared/api";
import type { Component } from "vue";

export const providerIconOverrides: Readonly<Record<string, Component>> = {};

export function getProviderInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1)
    return Array.from(parts[0] ?? "?")
      .slice(0, 2)
      .join("")
      .toUpperCase();
  return parts
    .slice(0, 2)
    .map((part) => Array.from(part)[0] ?? "")
    .join("")
    .toUpperCase();
}

export function resolveProviderIcon(
  providerId: string,
  overrides: Readonly<Record<string, Component>> = providerIconOverrides,
): Component | undefined {
  return overrides[providerId];
}

export function getConnectedProviders(
  providers: readonly ProviderInfo[],
  configuredProviderIds: ReadonlySet<string>,
): ProviderInfo[] {
  return providers.filter((provider) => configuredProviderIds.has(provider.id));
}

export function getAvailableProviders(
  providers: readonly ProviderInfo[],
  configuredProviderIds: ReadonlySet<string>,
  query: string,
): ProviderInfo[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  return providers.filter(
    (provider) =>
      !configuredProviderIds.has(provider.id) &&
      (normalizedQuery === "" || provider.name.toLocaleLowerCase().includes(normalizedQuery)),
  );
}
