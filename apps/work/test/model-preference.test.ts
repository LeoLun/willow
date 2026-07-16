import { describe, expect, it } from "vitest";
import {
  MODEL_PREFERENCE_KEY,
  readModelPreference,
  resolveModelPreference,
  writeModelPreference,
  type StorageLike,
} from "../src/renderer/src/lib/model-preference";
import type { ProviderInfo } from "../src/shared/api";

const providers: ProviderInfo[] = [
  {
    id: "openai",
    name: "OpenAI",
    apiKeyLabel: "OpenAI API key",
    models: [
      { id: "gpt-1", name: "GPT 1" },
      { id: "gpt-2", name: "GPT 2" },
    ],
  },
  {
    id: "empty",
    name: "Empty",
    apiKeyLabel: "Empty API key",
    models: [],
  },
];

describe("model preference", () => {
  it("keeps a valid stored provider and model", () => {
    expect(resolveModelPreference(providers, { providerId: "openai", modelId: "gpt-2" })).toEqual({
      providerId: "openai",
      modelId: "gpt-2",
    });
  });

  it("falls back when a model or provider was removed", () => {
    expect(resolveModelPreference(providers, { providerId: "openai", modelId: "removed" })).toEqual(
      { providerId: "openai", modelId: "gpt-1" },
    );
    expect(
      resolveModelPreference(providers, { providerId: "removed", modelId: "removed" }),
    ).toEqual({ providerId: "openai", modelId: "gpt-1" });
  });

  it("handles empty provider and model catalogs", () => {
    expect(resolveModelPreference([], { providerId: "openai", modelId: "gpt-1" })).toBeUndefined();
    expect(resolveModelPreference(providers, { providerId: "empty", modelId: "old" })).toEqual({
      providerId: "empty",
      modelId: "",
    });
  });

  it("reads, writes, and rejects invalid persisted data", () => {
    const values = new Map<string, string>();
    const storage: StorageLike = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    };

    writeModelPreference(storage, { providerId: "openai", modelId: "gpt-2" });
    expect(readModelPreference(storage)).toEqual({ providerId: "openai", modelId: "gpt-2" });

    values.set(MODEL_PREFERENCE_KEY, "not-json");
    expect(readModelPreference(storage)).toBeUndefined();

    writeModelPreference(storage, undefined);
    expect(values.has(MODEL_PREFERENCE_KEY)).toBe(false);
  });
});
