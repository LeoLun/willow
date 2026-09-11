import type { Model, Provider } from "@earendil-works/pi-ai";

const deepseekFlash: Model<"openai-completions"> = {
  id: "deepseek-flash",
  name: "DeepSeek V4.1 Flash",
  provider: "deepseek",
  api: "openai-completions",
  baseUrl: "https://api.deepseek.com",
  reasoning: true,
  input: ["text", "image"],
  thinkingLevelMap: {
    minimal: null,
    low: "low",
    medium: null,
    high: "high",
    max: "max",
  },
  contextWindow: 1000000,
  maxTokens: 384000,
  cost: { input: 0.3, output: 1.2, cacheRead: 0.006, cacheWrite: 0 },
  compat: {
    supportsStore: false,
    supportsDeveloperRole: false,
    maxTokensField: "max_tokens",
    requiresReasoningContentOnAssistantMessages: true,
    thinkingFormat: "deepseek",
  },
};

/** Supplement the bundled catalog until pi-ai ships the canonical Flash model. */
export function withDeepSeekFlash(provider: Provider): Provider {
  return {
    ...provider,
    getModels: () => {
      const models = provider.getModels();
      return models.some(({ id }) => id === deepseekFlash.id) ? models : [...models, deepseekFlash];
    },
  };
}
