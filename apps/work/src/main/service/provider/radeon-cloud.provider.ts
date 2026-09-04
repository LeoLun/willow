import { createProvider, envApiKeyAuth, type Model, type Provider } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/api/openai-completions.lazy";
import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";

export const RADEON_CLOUD_PROVIDER_ID = "radeon-cloud";
export const RADEON_CLOUD_BASE_URL = "https://developer.amd.com.cn/radeon/api/v1";

function cloneDeepSeekModel(
  sourceModelId: "deepseek-v4-flash" | "deepseek-v4-flash-vision-exp",
  id: string,
  name: string,
): Model<"openai-completions"> {
  const source = getBuiltinModel("deepseek", sourceModelId);
  return {
    ...source,
    id,
    name,
    provider: RADEON_CLOUD_PROVIDER_ID,
    baseUrl: RADEON_CLOUD_BASE_URL,
    compat: {
      ...source.compat,
      thinkingFormat: "openai",
    },
  };
}

export function radeonCloudProvider(): Provider<"openai-completions"> {
  return createProvider({
    id: RADEON_CLOUD_PROVIDER_ID,
    name: "Radeon Cloud",
    baseUrl: RADEON_CLOUD_BASE_URL,
    auth: {
      apiKey: envApiKeyAuth("Radeon Cloud API key", ["RADEON_CLOUD_API_KEY"]),
    },
    models: [
      cloneDeepSeekModel(
        "deepseek-v4-flash-vision-exp",
        "DeepSeek-V4-Flash-Vision-Exp",
        "DeepSeek-V4-Flash-Vision-Exp",
      ),
      cloneDeepSeekModel("deepseek-v4-flash", "DeepSeek-V4-Flash", "DeepSeek-V4-Flash-0731"),
    ],
    api: openAICompletionsApi(),
  });
}
