import { ModelDao } from "@main/service/dao/model.dao.service";
import type { AddModelRequest, UpdateModelRequest } from "@shared/api";
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

  addModel(data: AddModelRequest) {
    if (data.isDefault) {
      this.modelDao.clearDefault();
    }
    return this.modelDao.insert(data);
  }

  updateModel(id: number, data: Omit<UpdateModelRequest, "id">) {
    if (data.isDefault) {
      this.modelDao.clearDefault();
    }
    return this.modelDao.update(id, data);
  }

  deleteModel(id: number) {
    return this.modelDao.deleteById(id);
  }

  setDefaultModel(id: number) {
    this.modelDao.clearDefault();
    return this.modelDao.update(id, { isDefault: true });
  }
}
