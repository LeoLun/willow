import { createModels } from "@earendil-works/pi-ai";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { describe, expect, it } from "vitest";

describe("DeepSeek model catalog", () => {
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
});
