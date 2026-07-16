import { describe, expect, it } from "vitest";
import type { Component } from "vue";
import {
  getAvailableProviders,
  getConnectedProviders,
  getProviderInitials,
  resolveProviderIcon,
} from "../src/renderer/src/layout/setting/provider-display";
import type { ProviderInfo } from "../src/shared/api";

const providers: ProviderInfo[] = [
  { id: "deepseek", name: "DeepSeek", apiKeyLabel: "DeepSeek API key", models: [] },
  { id: "openai", name: "OpenAI", apiKeyLabel: "OpenAI API key", models: [] },
  {
    id: "github-copilot",
    name: "GitHub Copilot",
    apiKeyLabel: "GitHub Copilot token",
    models: [],
  },
];

describe("provider display helpers", () => {
  it("partitions providers without changing catalog order", () => {
    const configured = new Set(["openai"]);

    expect(getConnectedProviders(providers, configured).map(({ id }) => id)).toEqual(["openai"]);
    expect(getAvailableProviders(providers, configured, "").map(({ id }) => id)).toEqual([
      "deepseek",
      "github-copilot",
    ]);
  });

  it("searches available providers by trimmed, case-insensitive name", () => {
    const configured = new Set<string>();

    expect(getAvailableProviders(providers, configured, "  DEEP ").map(({ id }) => id)).toEqual([
      "deepseek",
    ]);
    expect(getAvailableProviders(providers, configured, "copilot").map(({ id }) => id)).toEqual([
      "github-copilot",
    ]);
    expect(getAvailableProviders(providers, configured, "missing")).toEqual([]);
  });

  it("creates compact fallback initials", () => {
    expect(getProviderInitials("OpenAI")).toBe("OP");
    expect(getProviderInitials("GitHub Copilot")).toBe("GC");
    expect(getProviderInitials("  ")).toBe("?");
  });

  it("uses a manually supplied icon override", () => {
    const icon = {} as Component;

    expect(resolveProviderIcon("openai", { openai: icon })).toBe(icon);
    expect(resolveProviderIcon("deepseek", { openai: icon })).toBeUndefined();
  });
});
