import { getBuiltinModel } from "@earendil-works/pi-ai/providers/all";
import { describe, expect, it, vi } from "vitest";
import {
  createWillowModels,
  willowProviders,
} from "../src/main/service/provider/provider-registry";
import {
  RADEON_CLOUD_BASE_URL,
  RADEON_CLOUD_PROVIDER_ID,
  radeonCloudProvider,
} from "../src/main/service/provider/radeon-cloud.provider";

describe("Radeon Cloud provider", () => {
  it("uses the Radeon Cloud endpoint and API-key authentication", async () => {
    const provider = radeonCloudProvider();
    const env = vi.fn(async (name: string) =>
      name === "RADEON_CLOUD_API_KEY" ? "radeon-key" : undefined,
    );

    expect(provider).toMatchObject({
      id: RADEON_CLOUD_PROVIDER_ID,
      name: "Radeon Cloud",
      baseUrl: RADEON_CLOUD_BASE_URL,
    });
    expect(provider.auth.apiKey?.name).toBe("Radeon Cloud API key");
    await expect(
      provider.auth.apiKey?.resolve({
        ctx: { env, fileExists: async () => false },
        signal: new AbortController().signal,
      }),
    ).resolves.toEqual({
      auth: { apiKey: "radeon-key" },
      source: "RADEON_CLOUD_API_KEY",
    });
  });

  it("clones the native DeepSeek model metadata with Radeon request identifiers", () => {
    const [vision, flash] = radeonCloudProvider().getModels();
    const nativeVision = getBuiltinModel("deepseek", "deepseek-v4-flash-vision-exp");
    const nativeFlash = getBuiltinModel("deepseek", "deepseek-v4-flash");

    expect(vision).toEqual({
      ...nativeVision,
      id: "DeepSeek-V4-Flash-Vision-Exp",
      name: "DeepSeek-V4-Flash-Vision-Exp",
      provider: RADEON_CLOUD_PROVIDER_ID,
      baseUrl: RADEON_CLOUD_BASE_URL,
      compat: { ...nativeVision.compat, thinkingFormat: "openai" },
    });
    expect(flash).toEqual({
      ...nativeFlash,
      id: "DeepSeek-V4-Flash",
      name: "DeepSeek-V4-Flash-0731",
      provider: RADEON_CLOUD_PROVIDER_ID,
      baseUrl: RADEON_CLOUD_BASE_URL,
      compat: { ...nativeFlash.compat, thinkingFormat: "openai" },
    });
    expect(vision?.input).toEqual(["text", "image"]);
    expect(flash?.input).toEqual(["text"]);
    expect(vision?.compat?.thinkingFormat).toBe("openai");
    expect(flash?.compat?.thinkingFormat).toBe("openai");
  });

  it("sends reasoning_effort without the unsupported thinking parameter", async () => {
    const provider = radeonCloudProvider();
    const model = provider.getModels().find(({ id }) => id === "DeepSeek-V4-Flash")!;
    let requestBody: Record<string, unknown> | undefined;
    const fetchMock: typeof fetch = async (_input, init) => {
      requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
      return new Response(
        [
          'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":0,"model":"DeepSeek-V4-Flash","choices":[{"index":0,"delta":{"role":"assistant","content":"ok"},"finish_reason":null}]}',
          'data: {"id":"chatcmpl-1","object":"chat.completion.chunk","created":0,"model":"DeepSeek-V4-Flash","choices":[{"index":0,"delta":{},"finish_reason":"stop"}],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}',
          "data: [DONE]",
          "",
        ].join("\n\n"),
        { headers: { "content-type": "text/event-stream" } },
      );
    };

    const stream = provider.stream(
      model,
      {
        systemPrompt: "",
        messages: [{ role: "user", content: "Hello", timestamp: 1 }],
      },
      { apiKey: "radeon-key", fetch: fetchMock, reasoningEffort: "high", maxRetries: 0 },
    );
    await stream.result();

    expect(requestBody).toMatchObject({
      model: "DeepSeek-V4-Flash",
      reasoning_effort: "high",
    });
    expect(requestBody).not.toHaveProperty("thinking");
  });

  it("registers the provider in both catalog and runtime model collections", () => {
    expect(willowProviders().some(({ id }) => id === RADEON_CLOUD_PROVIDER_ID)).toBe(true);

    const models = createWillowModels();
    expect(models.getProvider(RADEON_CLOUD_PROVIDER_ID)?.name).toBe("Radeon Cloud");
    expect(models.getModel(RADEON_CLOUD_PROVIDER_ID, "DeepSeek-V4-Flash")?.name).toBe(
      "DeepSeek-V4-Flash-0731",
    );
    expect(
      models.getModel(RADEON_CLOUD_PROVIDER_ID, "DeepSeek-V4-Flash-Vision-Exp")?.input,
    ).toEqual(["text", "image"]);
  });
});
