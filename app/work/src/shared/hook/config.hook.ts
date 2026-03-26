import type {
  GetModelListResponse,
  AddModelRequest,
  AddModelResponse,
  UpdateModelRequest,
  UpdateModelResponse,
  DeleteModelRequest,
  DeleteModelResponse,
  SetDefaultModelRequest,
  SetDefaultModelResponse,
} from "../api";

export interface IConfigApi {
  getModelList(): Promise<GetModelListResponse>;
  addModel(request: AddModelRequest): Promise<AddModelResponse>;
  updateModel(request: UpdateModelRequest): Promise<UpdateModelResponse>;
  deleteModel(request: DeleteModelRequest): Promise<DeleteModelResponse>;
  setDefaultModel(request: SetDefaultModelRequest): Promise<SetDefaultModelResponse>;
}
