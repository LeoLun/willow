import type {
  DeleteCredentialRequest,
  DeleteCredentialResponse,
  GetAppInfoRequest,
  GetAppInfoResponse,
  GetCredentialRequest,
  GetCredentialResponse,
  GetProviderCatalogRequest,
  GetProviderCatalogResponse,
  SetCredentialRequest,
  SetCredentialResponse,
} from "../api";

export interface ISettingApi {
  getAppInfo(request?: GetAppInfoRequest): Promise<GetAppInfoResponse>;
  getProviderCatalog(request?: GetProviderCatalogRequest): Promise<GetProviderCatalogResponse>;
  getCredential(request: GetCredentialRequest): Promise<GetCredentialResponse>;
  setCredential(request: SetCredentialRequest): Promise<SetCredentialResponse>;
  deleteCredential(request: DeleteCredentialRequest): Promise<DeleteCredentialResponse>;
}
