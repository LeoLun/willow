import "reflect-metadata";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { describe, expect, it } from "vitest";
import { ProviderCatalogService } from "../src/main/service/provider-catalog.service";

describe("ProviderCatalogService", () => {
  it("maps every interactive API-key provider and its models", () => {
    const expected = builtinProviders().filter(
      (provider) =>
        provider.auth.apiKey?.login !== undefined &&
        provider.id !== "cloudflare-ai-gateway" &&
        provider.id !== "cloudflare-workers-ai",
    );
    const catalog = new ProviderCatalogService().getCatalog();

    expect(catalog.map((provider) => provider.id)).toEqual(expected.map((provider) => provider.id));
    expect(catalog).not.toContainEqual(expect.objectContaining({ id: "openai-codex" }));
    expect(catalog).not.toContainEqual(expect.objectContaining({ id: "amazon-bedrock" }));
    expect(catalog).not.toContainEqual(expect.objectContaining({ id: "cloudflare-ai-gateway" }));

    const openai = catalog.find((provider) => provider.id === "openai");
    expect(openai).toMatchObject({ name: "OpenAI", apiKeyLabel: "OpenAI API key" });
    expect(catalog.every((provider) => provider.apiKeyLabel.length > 0)).toBe(true);
    expect(openai?.models.length).toBeGreaterThan(0);
    expect(openai?.models[0]).toEqual(
      expect.objectContaining({
        id: expect.any(String),
        name: expect.any(String),
        thinkingLevels: expect.any(Array),
      }),
    );

    for (const provider of expected) {
      const catalogProvider = catalog.find((candidate) => candidate.id === provider.id);
      for (const model of provider.getModels()) {
        expect(
          catalogProvider?.models.find((candidate) => candidate.id === model.id)?.thinkingLevels,
        ).toEqual(getSupportedThinkingLevels(model).filter((level) => level !== "off"));
      }
    }

    const deepseekV4Pro = catalog
      .find((provider) => provider.id === "deepseek")
      ?.models.find((model) => model.id === "deepseek-v4-pro");
    expect(deepseekV4Pro?.thinkingLevels).toEqual(["high", "max"]);
  });
});
