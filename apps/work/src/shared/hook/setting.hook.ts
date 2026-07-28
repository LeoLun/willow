import type {
  DeleteCredentialRequest,
  DeleteCredentialResponse,
  DeleteTavilyApiKeyRequest,
  DeleteTavilyApiKeyResponse,
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
  GetTavilySettingsRequest,
  GetTavilySettingsResponse,
  GetUserConfigRequest,
  GetUserConfigResponse,
  SetCredentialRequest,
  SetCredentialResponse,
  SetThemeRequest,
  SetThemeResponse,
  SetTavilyApiKeyRequest,
  SetTavilyApiKeyResponse,
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
  getTavilySettings(request?: GetTavilySettingsRequest): Promise<GetTavilySettingsResponse>;
  setTavilyApiKey(request: SetTavilyApiKeyRequest): Promise<SetTavilyApiKeyResponse>;
  deleteTavilyApiKey(request?: DeleteTavilyApiKeyRequest): Promise<DeleteTavilyApiKeyResponse>;
  getUserConfig(request?: GetUserConfigRequest): Promise<GetUserConfigResponse>;
  setUserConfig(request: SetUserConfigRequest): Promise<SetUserConfigResponse>;
}
