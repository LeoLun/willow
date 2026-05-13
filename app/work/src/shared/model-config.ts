export interface BuiltinModelDef {
  modelId: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
  input: string[];
  cost: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
  };
  compat: {
    requiresReasoningContentOnAssistantMessages: boolean;
    thinkingFormat: string;
    reasoningEffortMap: Record<string, string>;
  };
}

export interface BuiltinProviderConfig {
  provider: string;
  baseUrl: string;
  api: string;
  models: BuiltinModelDef[];
}

export const DEEPSEEK_PROVIDER_CONFIG: BuiltinProviderConfig = {
  provider: "deepseek",
  baseUrl: "https://api.deepseek.com",
  api: "openai-completions",
  models: [
    {
      modelId: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      contextWindow: 1000000,
      maxTokens: 384000,
      reasoning: true,
      input: ["text"],
      cost: {
        input: 1.74,
        output: 3.48,
        cacheRead: 0.145,
        cacheWrite: 0,
      },
      compat: {
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "deepseek",
        reasoningEffortMap: {
          minimal: "high",
          low: "high",
          medium: "high",
          high: "high",
          xhigh: "max",
        },
      },
    },
    {
      modelId: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      contextWindow: 1000000,
      maxTokens: 384000,
      reasoning: true,
      input: ["text"],
      cost: {
        input: 0.14,
        output: 0.28,
        cacheRead: 0.028,
        cacheWrite: 0,
      },
      compat: {
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: "deepseek",
        reasoningEffortMap: {
          minimal: "high",
          low: "high",
          medium: "high",
          high: "high",
          xhigh: "max",
        },
      },
    },
  ],
};

export function isBuiltinModel(modelId: string): boolean {
  return DEEPSEEK_PROVIDER_CONFIG.models.some((m) => m.modelId === modelId);
}

export function getBuiltinModelConfig(modelId: string): BuiltinModelDef | undefined {
  return DEEPSEEK_PROVIDER_CONFIG.models.find((m) => m.modelId === modelId);
}
