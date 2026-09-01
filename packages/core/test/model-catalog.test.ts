import { createModels, getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { zaiProvider } from "@earendil-works/pi-ai/providers/zai";
import { describe, expect, it } from "vitest";

describe("Pi model catalog", () => {
  it.each(["deepseek-v4-pro", "deepseek-v4-flash", "deepseek-v4-flash-vision-exp"])(
    "contains %s",
    (modelId) => {
      const models = createModels();
      models.setProvider(deepseekProvider());

      expect(models.getModel("deepseek", modelId)?.id).toBe(modelId);
    },
  );

  it("adds image input to the V4 Flash Vision Exp model", () => {
    const models = deepseekProvider().getModels();
    const flash = models.find((model) => model.id === "deepseek-v4-flash");
    const vision = models.find((model) => model.id === "deepseek-v4-flash-vision-exp");
    const builtinVision = getBuiltinModel("deepseek", "deepseek-v4-flash-vision-exp");

    expect(flash).toBeDefined();
    expect(builtinVision).toEqual(vision);
    expect(vision).toEqual({
      ...flash,
      id: "deepseek-v4-flash-vision-exp",
      name: "DeepSeek V4 Flash Vision Exp",
      input: ["text", "image"],
    });
  });

  it("contains the multimodal GLM-5.3 Flash model", () => {
    const models = zaiProvider().getModels();
    const flash = models.find((model) => model.id === "glm-5.3-flash");
    const builtinFlash = getBuiltinModel("zai", "glm-5.3-flash");

    expect(builtinFlash).toEqual(flash);
    expect(flash).toMatchObject({
      id: "glm-5.3-flash",
      name: "GLM-5.3-Flash",
      input: ["text", "image"],
      contextWindow: 1_000_000,
    });
    expect(getSupportedThinkingLevels(flash!)).toEqual(["low", "high", "max"]);
  });
});
