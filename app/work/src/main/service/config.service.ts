import { ModelDao } from "@main/service/dao/model.dao.service";
import { DEEPSEEK_PROVIDER_CONFIG } from "@shared/model-config";
import { Injectable } from "@willow/poetry";

@Injectable()
export class ConfigService {
  constructor(private readonly modelDao: ModelDao) {}

  getModelList() {
    return this.modelDao.findAll();
  }

  getModelById(id: number) {
    return this.modelDao.findById(id);
  }

  getModelByModelId(modelId: string) {
    return this.modelDao.findByModelId(modelId);
  }

  getDefaultModel() {
    return this.modelDao.findDefault();
  }

  upsertBuiltinModels(apiKey: string) {
    const results = DEEPSEEK_PROVIDER_CONFIG.models.map((def, index) => {
      return this.modelDao.upsertByModelId({
        modelId: def.modelId,
        name: def.name,
        provider: DEEPSEEK_PROVIDER_CONFIG.provider,
        baseUrl: DEEPSEEK_PROVIDER_CONFIG.baseUrl,
        api: DEEPSEEK_PROVIDER_CONFIG.api,
        apiKey,
        reasoning: def.reasoning,
        contextWindow: def.contextWindow,
        maxTokens: def.maxTokens,
        isDefault: index === 1, // deepseek-v4-flash is the second model
      });
    });
    return results;
  }

  clearBuiltinModels() {
    for (const def of DEEPSEEK_PROVIDER_CONFIG.models) {
      this.modelDao.deleteByModelId(def.modelId);
    }
  }

  setDefaultModel(id: number) {
    this.modelDao.clearDefault();
    return this.modelDao.update(id, { isDefault: true });
  }

  updateModel(id: number, data: { isDefault?: boolean }) {
    if (data.isDefault) {
      this.modelDao.clearDefault();
    }
    return this.modelDao.update(id, data);
  }
}
