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
  GetStatisticsRequest,
  GetStatisticsResponse,
  GetUserConfigRequest,
  GetUserConfigResponse,
  SetCredentialRequest,
  SetCredentialResponse,
  SetThemeRequest,
  SetThemeResponse,
  SetUserConfigRequest,
  SetUserConfigResponse,
} from "../api";

export interface ISettingApi {
  getAppInfo(request?: GetAppInfoRequest): Promise<GetAppInfoResponse>;
  setTheme(request: SetThemeRequest): Promise<SetThemeResponse>;
  getProviderCatalog(request?: GetProviderCatalogRequest): Promise<GetProviderCatalogResponse>;
  getConfiguredProviders(
    request?: GetConfiguredProvidersRequest,
  ): Promise<GetConfiguredProvidersResponse>;
  getStatistics(request: GetStatisticsRequest): Promise<GetStatisticsResponse>;
  getCredential(request: GetCredentialRequest): Promise<GetCredentialResponse>;
  setCredential(request: SetCredentialRequest): Promise<SetCredentialResponse>;
  deleteCredential(request: DeleteCredentialRequest): Promise<DeleteCredentialResponse>;
  getUserConfig(request?: GetUserConfigRequest): Promise<GetUserConfigResponse>;
  setUserConfig(request: SetUserConfigRequest): Promise<SetUserConfigResponse>;
}
