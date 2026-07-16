import type { ModelConfig, UserConfigInfo } from "@shared/api";
import { Injectable } from "@willow/poetry";
import { CredentialService } from "./credential.service";
import { UserConfigDao } from "./dao/user-config.dao.server";
import { ProviderCatalogService } from "./provider-catalog.service";

@Injectable()
export class UserConfigService {
  constructor(
    private readonly userConfigDao: UserConfigDao,
    private readonly credentialService: CredentialService,
    private readonly providerCatalogService: ProviderCatalogService,
  ) {}

  getConfig(): UserConfigInfo {
    const config = this.userConfigDao.find();
    if (!config) return {};

    return {
      largeModel: this.toModelConfig(config.largeModelProviderId, config.largeModelId),
      smallModel: this.toModelConfig(config.smallModelProviderId, config.smallModelId),
    };
  }

  async setConfig(config: UserConfigInfo): Promise<UserConfigInfo> {
    await this.validateModel(config.largeModel);
    await this.validateModel(config.smallModel);

    const current = this.getConfig();
    const next = { ...current, ...config };

    const saved = this.userConfigDao.upsert({
      largeModelProviderId: next.largeModel?.providerId ?? null,
      largeModelId: next.largeModel?.modelId ?? null,
      smallModelProviderId: next.smallModel?.providerId ?? null,
      smallModelId: next.smallModel?.modelId ?? null,
    });

    return {
      largeModel: this.toModelConfig(saved.largeModelProviderId, saved.largeModelId),
      smallModel: this.toModelConfig(saved.smallModelProviderId, saved.smallModelId),
    };
  }

  private toModelConfig(
    providerId: string | null,
    modelId: string | null,
  ): ModelConfig | undefined {
    return providerId && modelId ? { providerId, modelId } : undefined;
  }

  private async validateModel(model: ModelConfig | undefined): Promise<void> {
    if (!model) return;

    const credential = await this.credentialService.getCredential(model.providerId);
    if (!credential) {
      throw new Error(`Provider ${model.providerId} is not configured`);
    }

    const provider = this.providerCatalogService.getProvider(model.providerId);
    if (!provider?.getModels().some(({ id }) => id === model.modelId)) {
      throw new Error(`Model ${model.modelId} is not available for provider ${model.providerId}`);
    }
  }
}
