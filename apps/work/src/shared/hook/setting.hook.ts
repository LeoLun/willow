import type {
  DeleteCredentialRequest,
  DeleteCredentialResponse,
  GetAppInfoRequest,
  GetAppInfoResponse,
  GetConfiguredProvidersRequest,
  GetConfiguredProvidersResponse,
  GetCredentialRequest,
  GetCredentialResponse,
  GetProviderCatalogRequest,
  GetProviderCatalogResponse,
  GetUserConfigRequest,
  GetUserConfigResponse,
  SetCredentialRequest,
  SetCredentialResponse,
  SetUserConfigRequest,
  SetUserConfigResponse,
} from "../api";

export interface ISettingApi {
  getAppInfo(request?: GetAppInfoRequest): Promise<GetAppInfoResponse>;
  getProviderCatalog(request?: GetProviderCatalogRequest): Promise<GetProviderCatalogResponse>;
  getConfiguredProviders(
    request?: GetConfiguredProvidersRequest,
  ): Promise<GetConfiguredProvidersResponse>;
  getCredential(request: GetCredentialRequest): Promise<GetCredentialResponse>;
  setCredential(request: SetCredentialRequest): Promise<SetCredentialResponse>;
  deleteCredential(request: DeleteCredentialRequest): Promise<DeleteCredentialResponse>;
  getUserConfig(request?: GetUserConfigRequest): Promise<GetUserConfigResponse>;
  setUserConfig(request: SetUserConfigRequest): Promise<SetUserConfigResponse>;
}
