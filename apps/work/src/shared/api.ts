export interface ApiResponse<K> {
  code: number;
  msg: string;
  data?: K;
}
export interface RegisterEventRequest {
  event?: string;
}

export interface RegisterEventResponse {}

export interface GetAppInfoRequest {}

export interface GetAppInfoResponse {
  name: string;
  version: string;
}

export type ThemeMode = "system" | "light" | "dark";

export interface SetThemeRequest {
  mode: ThemeMode;
}

export interface SetThemeResponse {}

export interface ProviderModelInfo {
  id: string;
  name: string;
}

export interface ProviderInfo {
  id: string;
  name: string;
  apiKeyLabel: string;
  models: ProviderModelInfo[];
}

export interface GetProviderCatalogRequest {}

export interface GetProviderCatalogResponse {
  providers: ProviderInfo[];
}

export interface GetCredentialRequest {
  providerId: string;
}

export interface GetCredentialResponse {
  configured: boolean;
}

export interface GetConfiguredProvidersRequest {}

export interface GetConfiguredProvidersResponse {
  providerIds: string[];
}

export interface SetCredentialRequest {
  providerId: string;
  apiKey: string;
}

export interface SetCredentialResponse {}

export interface DeleteCredentialRequest {
  providerId: string;
}

export interface DeleteCredentialResponse {}

export interface ModelConfig {
  providerId: string;
  modelId: string;
}

export interface UserConfigInfo {
  largeModel?: ModelConfig;
  smallModel?: ModelConfig;
}

export interface GetUserConfigRequest {}

export type GetUserConfigResponse = UserConfigInfo;

export type SetUserConfigRequest = UserConfigInfo;

export type SetUserConfigResponse = UserConfigInfo;
