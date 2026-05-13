import type {
  GetModelListResponse,
  SetDeepSeekApiKeyRequest,
  SetDeepSeekApiKeyResponse,
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
  setDeepSeekApiKey(request: SetDeepSeekApiKeyRequest): Promise<SetDeepSeekApiKeyResponse>;
  setDefaultModel(request: SetDefaultModelRequest): Promise<SetDefaultModelResponse>;
  getTavilyKeyList(): Promise<GetTavilyKeyListResponse>;
  addTavilyKey(request: AddTavilyKeyRequest): Promise<AddTavilyKeyResponse>;
  updateTavilyKey(request: UpdateTavilyKeyRequest): Promise<UpdateTavilyKeyResponse>;
  deleteTavilyKey(request: DeleteTavilyKeyRequest): Promise<DeleteTavilyKeyResponse>;
}
