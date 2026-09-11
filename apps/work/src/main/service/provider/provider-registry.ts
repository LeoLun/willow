import {
  createModels,
  type CreateModelsOptions,
  type MutableModels,
  type Provider,
} from "@earendil-works/pi-ai";
import { builtinProviders } from "@earendil-works/pi-ai/providers/all";
import { withDeepSeekFlash } from "./deepseek.provider";
import { radeonCloudProvider } from "./radeon-cloud.provider";

export function willowProviders(): Provider[] {
  return [
    ...builtinProviders().map((provider) =>
      provider.id === "deepseek" ? withDeepSeekFlash(provider) : provider,
    ),
    radeonCloudProvider(),
  ];
}

export function createWillowModels(options?: CreateModelsOptions): MutableModels {
  const models = createModels(options);
  for (const provider of willowProviders()) {
    models.setProvider(provider);
  }
  return models;
}
