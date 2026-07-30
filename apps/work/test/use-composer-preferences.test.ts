// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp, nextTick } from "vue";
import {
  COMPOSER_PREFERENCES_STORAGE_KEY,
  useComposerPreferences,
} from "../src/renderer/src/composables/useComposerPreferences";

const mountedApps: ReturnType<typeof createApp>[] = [];

function mountPreferences() {
  let preferences: ReturnType<typeof useComposerPreferences> | undefined;
  const app = createApp({
    setup() {
      preferences = useComposerPreferences();
      return () => null;
    },
  });
  app.mount(document.createElement("div"));
  mountedApps.push(app);

  if (!preferences) throw new Error("Composer preferences were not initialized");
  return preferences;
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
});

describe("useComposerPreferences", () => {
  it("restores the last valid composer selections", () => {
    localStorage.setItem(
      COMPOSER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        approvalMode: "delegate-approval",
        model: { providerId: "openai", modelId: "gpt-5" },
        reasoningEffort: "high",
      }),
    );

    expect(mountPreferences().value).toEqual({
      approvalMode: "delegate-approval",
      model: { providerId: "openai", modelId: "gpt-5" },
      reasoningEffort: "high",
    });
  });

  it("falls back safely when cached fields are invalid", () => {
    localStorage.setItem(
      COMPOSER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        approvalMode: "unknown",
        model: { providerId: "", modelId: 3 },
        reasoningEffort: "",
      }),
    );

    expect(mountPreferences().value).toEqual({
      approvalMode: "request-approval",
      model: undefined,
      reasoningEffort: undefined,
    });
  });

  it("ignores malformed and unsupported cache versions", () => {
    localStorage.setItem(COMPOSER_PREFERENCES_STORAGE_KEY, "{invalid");
    expect(mountPreferences().value).toEqual({ approvalMode: "request-approval" });

    mountedApps.pop()?.unmount();
    localStorage.setItem(
      COMPOSER_PREFERENCES_STORAGE_KEY,
      JSON.stringify({ version: 2, approvalMode: "full-access" }),
    );
    expect(mountPreferences().value).toEqual({ approvalMode: "request-approval" });
  });

  it("persists every selection update", async () => {
    const preferences = mountPreferences();
    preferences.value = {
      approvalMode: "full-access",
      model: { providerId: "anthropic", modelId: "claude" },
      reasoningEffort: "max",
    };

    await nextTick();
    await vi.waitFor(() =>
      expect(JSON.parse(localStorage.getItem(COMPOSER_PREFERENCES_STORAGE_KEY)!)).toEqual({
        version: 1,
        approvalMode: "full-access",
        model: { providerId: "anthropic", modelId: "claude" },
        reasoningEffort: "max",
      }),
    );
  });
});
