import { getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { describe, expect, it } from "vitest";
import { withDeepSeekFlash } from "../src/main/service/provider/deepseek.provider";
import {
  createWillowModels,
  willowProviders,
} from "../src/main/service/provider/provider-registry";

describe("DeepSeek V4.1 Flash", () => {
  it("registers the model in the catalog and runtime while retaining existing models and auth", () => {
    const provider = willowProviders().find(({ id }) => id === "deepseek")!;
    const model = createWillowModels().getModel("deepseek", "deepseek-flash")!;

    expect(provider.getModels()).toContainEqual(model);
    expect(provider.getModels().some(({ id }) => id === "deepseek-v4-pro")).toBe(true);
    expect(provider.auth.apiKey?.login).toBeDefined();
    expect(model).toMatchObject({
      name: "DeepSeek V4.1 Flash",
      api: "openai-completions",
      baseUrl: "https://api.deepseek.com",
      input: ["text", "image"],
      reasoning: true,
      contextWindow: 1000000,
      maxTokens: 384000,
      cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
      compat: { thinkingFormat: "deepseek", requiresReasoningContentOnAssistantMessages: true },
    });
    expect(getSupportedThinkingLevels(model)).toEqual(["off", "low", "high", "max"]);
  });

  it("preserves upstream metadata when the canonical model is already present", () => {
    const provider = willowProviders().find(({ id }) => id === "deepseek")!;
    const models = provider.getModels();
    expect(withDeepSeekFlash({ ...provider, getModels: () => models }).getModels()).toBe(models);
    expect(models.filter(({ id }) => id === "deepseek-flash")).toHaveLength(1);
  });
});
