import "reflect-metadata";
import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { ProviderCatalogService } from "../src/main/service/provider-catalog.service";
import { willowProviders } from "../src/main/service/provider/provider-registry";

describe("ProviderCatalogService", () => {
  it("maps every interactive API-key provider and its models", () => {
    const expected = willowProviders().filter(
      (provider) =>
        provider.auth.apiKey?.login !== undefined &&
        provider.id !== "amazon-bedrock" &&
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
        contextWindow: expect.any(Number),
        thinkingLevels: expect.any(Array),
      }),
    );

    const radeonCloud = catalog.find((provider) => provider.id === "radeon-cloud");
    expect(radeonCloud).toMatchObject({
      name: "Radeon Cloud",
      apiKeyLabel: "Radeon Cloud API key",
      models: [
        {
          id: "DeepSeek-V4-Flash-Vision-Exp",
          name: "DeepSeek-V4-Flash-Vision-Exp",
          contextWindow: 1_000_000,
          thinkingLevels: ["low", "high", "max"],
        },
        {
          id: "DeepSeek-V4-Flash",
          name: "DeepSeek-V4-Flash-0731",
          contextWindow: 1_000_000,
          thinkingLevels: ["low", "high", "max"],
        },
      ],
    });

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

    const deepseekVision = catalog
      .find((provider) => provider.id === "deepseek")
      ?.models.find((model) => model.id === "deepseek-v4-flash-vision-exp");
    expect(deepseekVision?.thinkingLevels).toEqual(["low", "high", "max"]);

    const glmFlash = catalog
      .find((provider) => provider.id === "zai")
      ?.models.find((model) => model.id === "glm-5.3-flash");
    expect(glmFlash?.thinkingLevels).toEqual(["low", "high", "max"]);
  });
});
