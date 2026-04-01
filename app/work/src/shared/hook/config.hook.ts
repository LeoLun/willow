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
  GetTavilyKeyListResponse,
  AddTavilyKeyRequest,
  AddTavilyKeyResponse,
  UpdateTavilyKeyRequest,
  UpdateTavilyKeyResponse,
  DeleteTavilyKeyRequest,
  DeleteTavilyKeyResponse,
} from "../api";

export interface IConfigApi {
  getModelList(): Promise<GetModelListResponse>;
  addModel(request: AddModelRequest): Promise<AddModelResponse>;
  updateModel(request: UpdateModelRequest): Promise<UpdateModelResponse>;
  deleteModel(request: DeleteModelRequest): Promise<DeleteModelResponse>;
  setDefaultModel(request: SetDefaultModelRequest): Promise<SetDefaultModelResponse>;
  getTavilyKeyList(): Promise<GetTavilyKeyListResponse>;
  addTavilyKey(request: AddTavilyKeyRequest): Promise<AddTavilyKeyResponse>;
  updateTavilyKey(request: UpdateTavilyKeyRequest): Promise<UpdateTavilyKeyResponse>;
  deleteTavilyKey(request: DeleteTavilyKeyRequest): Promise<DeleteTavilyKeyResponse>;
}
