import { readFile } from "node:fs/promises";
import { authorizeMemoryPath, isMissingFile } from "./paths.js";
import type { MemoryConfig, MemoryOptions, MemoryScope, ResolvedMemoryConfig } from "./types.js";

export const DEFAULT_MEMORY_CONFIG: Readonly<MemoryConfig> = {
  enabled: true,
  maxGlobalMemoryBytes: 16_384,
  maxProjectMemoryBytes: 16_384,
};

async function readConfig(
  options: MemoryOptions,
  scope: MemoryScope,
): Promise<Partial<MemoryConfig>> {
  const path = await authorizeMemoryPath(options, scope, true);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if (isMissingFile(error)) return {};
    throw error;
  }
  const config: unknown = JSON.parse(text);
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error("Memory config must be an object");
  const value = config as Record<string, unknown>;
  if (value.enabled !== undefined && typeof value.enabled !== "boolean")
    throw new Error("Memory enabled must be boolean");
  for (const key of ["maxGlobalMemoryBytes", "maxProjectMemoryBytes"] as const) {
    if (value[key] !== undefined && (!Number.isSafeInteger(value[key]) || Number(value[key]) <= 0))
      throw new Error(`${key} must be a positive safe integer`);
  }
  return {
    ...(value.enabled !== undefined ? { enabled: value.enabled as boolean } : {}),
    ...(value.maxGlobalMemoryBytes !== undefined
      ? { maxGlobalMemoryBytes: value.maxGlobalMemoryBytes as number }
      : {}),
    ...(value.maxProjectMemoryBytes !== undefined
      ? { maxProjectMemoryBytes: value.maxProjectMemoryBytes as number }
      : {}),
  };
}

export async function resolveMemoryConfig(options: MemoryOptions): Promise<ResolvedMemoryConfig> {
  let config = { ...DEFAULT_MEMORY_CONFIG };
  const errors: ResolvedMemoryConfig["errors"] = {};
  try {
    config = { ...config, ...(await readConfig(options, "global")) };
  } catch (error) {
    errors.global = String(error);
    return { ...config, enabled: false, projectEnabled: false, errors };
  }
  const globallyEnabled = config.enabled;
  if (options.projectTrusted) {
    try {
      config = { ...config, ...(await readConfig(options, "project")) };
    } catch (error) {
      errors.project = String(error);
    }
  }
  return {
    ...config,
    enabled: globallyEnabled && config.enabled,
    projectEnabled:
      !!options.projectTrusted && globallyEnabled && config.enabled && !errors.project,
    errors,
  };
}
