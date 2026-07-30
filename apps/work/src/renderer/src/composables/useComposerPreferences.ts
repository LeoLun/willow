import type { ModelConfig, PermissionMode } from "@shared/api";
import { useLocalStorage } from "@vueuse/core";

export const COMPOSER_PREFERENCES_STORAGE_KEY = "willow:composer-preferences";

export interface ComposerPreferences {
  approvalMode: PermissionMode;
  model?: ModelConfig;
  reasoningEffort?: string;
}

const defaultPreferences: ComposerPreferences = {
  approvalMode: "request-approval",
};

function isPermissionMode(value: unknown): value is PermissionMode {
  return value === "request-approval" || value === "delegate-approval" || value === "full-access";
}

function parseModel(value: unknown): ModelConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;

  const candidate = value as Partial<ModelConfig>;
  if (
    typeof candidate.providerId !== "string" ||
    candidate.providerId.trim() === "" ||
    typeof candidate.modelId !== "string" ||
    candidate.modelId.trim() === ""
  ) {
    return undefined;
  }

  return {
    providerId: candidate.providerId,
    modelId: candidate.modelId,
  };
}

function normalizePreferences(value: unknown): ComposerPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ...defaultPreferences };
  }

  const candidate = value as {
    version?: unknown;
    approvalMode?: unknown;
    model?: unknown;
    reasoningEffort?: unknown;
  };
  if (candidate.version !== 1) return { ...defaultPreferences };

  const model = parseModel(candidate.model);
  const reasoningEffort =
    typeof candidate.reasoningEffort === "string" && candidate.reasoningEffort.trim() !== ""
      ? candidate.reasoningEffort
      : undefined;

  return {
    approvalMode: isPermissionMode(candidate.approvalMode)
      ? candidate.approvalMode
      : defaultPreferences.approvalMode,
    model,
    reasoningEffort,
  };
}

export function useComposerPreferences() {
  return useLocalStorage<ComposerPreferences>(
    COMPOSER_PREFERENCES_STORAGE_KEY,
    { ...defaultPreferences },
    {
      serializer: {
        read: (raw) => {
          try {
            return normalizePreferences(JSON.parse(raw));
          } catch {
            return { ...defaultPreferences };
          }
        },
        write: (value) =>
          JSON.stringify({
            version: 1,
            ...value,
          }),
      },
      onError: () => {
        // Keep the in-memory selection when localStorage is unavailable or full.
      },
    },
  );
}
