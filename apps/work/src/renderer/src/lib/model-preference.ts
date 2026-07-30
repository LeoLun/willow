import type { ProviderInfo } from "@shared/api";

export const MODEL_PREFERENCE_KEY = "default-model";

export interface ModelPreference {
  providerId: string;
  modelId: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function resolveModelPreference(
  providers: ProviderInfo[],
  stored?: ModelPreference,
): ModelPreference | undefined {
  const provider = providers.find((item) => item.id === stored?.providerId) ?? providers[0];
  if (!provider) return undefined;

  const model = provider.models.find((item) => item.id === stored?.modelId) ?? provider.models[0];
  return { providerId: provider.id, modelId: model?.id ?? "" };
}

export function readModelPreference(storage: StorageLike): ModelPreference | undefined {
  const value = storage.getItem(MODEL_PREFERENCE_KEY);
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as Partial<ModelPreference>;
    if (typeof parsed.providerId === "string" && typeof parsed.modelId === "string") {
      return { providerId: parsed.providerId, modelId: parsed.modelId };
    }
  } catch {
    // Invalid local preferences are replaced with a catalog-backed default.
  }
  return undefined;
}

export function writeModelPreference(
  storage: StorageLike,
  preference: ModelPreference | undefined,
): void {
  if (!preference) {
    storage.removeItem(MODEL_PREFERENCE_KEY);
    return;
  }
  storage.setItem(MODEL_PREFERENCE_KEY, JSON.stringify(preference));
}
