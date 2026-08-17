import { getSupportedThinkingLevels, type Provider } from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import type { ProviderInfo, ThinkingLevel } from "@shared/api";
import { Injectable } from "@willow/poetry";

const MULTI_FIELD_API_KEY_PROVIDERS = new Set(["cloudflare-ai-gateway", "cloudflare-workers-ai"]);

@Injectable()
export class ProviderCatalogService {
  private readonly providers = builtinProviders().filter(
    (provider) =>
      provider.auth.apiKey?.login !== undefined && !MULTI_FIELD_API_KEY_PROVIDERS.has(provider.id),
  );

  getCatalog(): ProviderInfo[] {
    return this.providers.map((provider) => ({
      id: provider.id,
      name: provider.name,
      apiKeyLabel: provider.auth.apiKey?.name ?? `${provider.name} API key`,
      models: provider.getModels().map((model) => ({
        id: model.id,
        name: model.name,
        contextWindow: model.contextWindow,
        thinkingLevels: getSupportedThinkingLevels(model).filter(
          (level): level is ThinkingLevel => level !== "off",
        ),
      })),
    }));
  }

  getProvider(providerId: string): Provider | undefined {
    return this.providers.find((provider) => provider.id === providerId);
  }
}
