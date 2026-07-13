import { createModels } from "@earendil-works/pi-ai";
import { deepseekProvider } from "@earendil-works/pi-ai/providers/deepseek";
import { describe, expect, it } from "vitest";

describe("DeepSeek model catalog", () => {
  it.each(["deepseek-v4-pro", "deepseek-v4-flash"])("contains %s", (modelId) => {
    const models = createModels();
    models.setProvider(deepseekProvider());

    expect(models.getModel("deepseek", modelId)?.id).toBe(modelId);
  });
});
