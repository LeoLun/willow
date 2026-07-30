import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { IRenderHook } from "../shared";
import type {
  ApiResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  DeleteCredentialRequest,
  DeleteCredentialResponse,
  DeleteTavilyApiKeyRequest,
  DeleteTavilyApiKeyResponse,
  GetAppInfoRequest,
  GetAppInfoResponse,
  GetBuiltinSkillListRequest,
  GetBuiltinSkillListResponse,
  GetConfiguredProvidersRequest,
  GetConfiguredProvidersResponse,
  GetCredentialRequest,
  GetCredentialResponse,
  GetMessageListRequest,
  GetMessageListResponse,
  GetProviderCatalogRequest,
  GetProviderCatalogResponse,
  GetStatisticsRequest,
  GetStatisticsResponse,
  GetTavilySettingsRequest,
  GetTavilySettingsResponse,
  GetSessionListRequest,
  GetSessionListResponse,
  GetSkillListRequest,
  GetSkillListResponse,
  GetUserConfigRequest,
  GetUserConfigResponse,
  GetWorkspaceListRequest,
  GetWorkspaceListResponse,
  RegisterEventRequest,
  RegisterEventResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse,
  SearchFilesRequest,
  SearchFilesResponse,
  SendMessageRequest,
  SendMessageResponse,
  SetCredentialRequest,
  SetCredentialResponse,
  SetBuiltinSkillEnabledRequest,
  SetBuiltinSkillEnabledResponse,
  SetThemeRequest,
  SetThemeResponse,
  SetTavilyApiKeyRequest,
  SetTavilyApiKeyResponse,
  SetUserConfigRequest,
  SetUserConfigResponse,
  SelectWorkspaceDirectoryRequest,
  SelectWorkspaceDirectoryResponse,
  SetWorkspacePinnedRequest,
  SetWorkspacePinnedResponse,
  StopMessageRequest,
  StopMessageResponse,
} from "../shared/api";
import {
  CREATE_SESSION,
  DELETE_CREDENTIAL,
  DELETE_TAVILY_API_KEY,
  CREATE_WORKSPACE,
  DELETE_WORKSPACE,
  EVENT_BUS,
  GET_APP_INFO,
  GET_BUILTIN_SKILL_LIST,
  GET_CONFIGURED_PROVIDERS,
  GET_CREDENTIAL,
  GET_MESSAGE_LIST,
  GET_PROVIDER_CATALOG,
  GET_STATISTICS,
  GET_TAVILY_SETTINGS,
  GET_SESSION_LIST,
  GET_SKILL_LIST,
  GET_USER_CONFIG,
  GET_WORKSPACE_LIST,
  REGISTER_EVENT,
  RENAME_WORKSPACE,
  RESOLVE_TOOL_APPROVAL,
  SEARCH_FILES,
  SEND_MESSAGE,
  SET_CREDENTIAL,
  SET_BUILTIN_SKILL_ENABLED,
  SET_THEME,
  SET_TAVILY_API_KEY,
  SET_USER_CONFIG,
  SELECT_WORKSPACE_DIRECTORY,
  SET_WORKSPACE_PINNED,
  STOP_MESSAGE,
} from "../shared/constants";

async function invoke<TRequest, TResponse>(event: string, request: TRequest): Promise<TResponse> {
  const response = (await ipcRenderer.invoke(event, request)) as ApiResponse<TResponse>;
  if (response.code !== 0 || response.data === undefined) {
    throw new Error(response.msg);
  }
  return response.data;
}

const ipcObject: IRenderHook = {
  registerEvent: async (
    request: RegisterEventRequest,
    callback?: (event: string, data: any) => void,
  ) => {
    const response = (await ipcRenderer.invoke(
      REGISTER_EVENT,
      request,
    )) as ApiResponse<RegisterEventResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (callback) {
      ipcObject.onEventBus(callback);
    }
    if (!response.data) {
      throw new Error("register event failed");
    }
    return response.data;
  },
  getAppInfo: (request: GetAppInfoRequest = {}) =>
    invoke<GetAppInfoRequest, GetAppInfoResponse>(GET_APP_INFO, request),
  setTheme: (request: SetThemeRequest) =>
    invoke<SetThemeRequest, SetThemeResponse>(SET_THEME, request),
  getProviderCatalog: (request: GetProviderCatalogRequest = {}) =>
    invoke<GetProviderCatalogRequest, GetProviderCatalogResponse>(GET_PROVIDER_CATALOG, request),
  getConfiguredProviders: (request: GetConfiguredProvidersRequest = {}) =>
    invoke<GetConfiguredProvidersRequest, GetConfiguredProvidersResponse>(
      GET_CONFIGURED_PROVIDERS,
      request,
    ),
  getStatistics: (request: GetStatisticsRequest) =>
    invoke<GetStatisticsRequest, GetStatisticsResponse>(GET_STATISTICS, request),
  getCredential: (request: GetCredentialRequest) =>
    invoke<GetCredentialRequest, GetCredentialResponse>(GET_CREDENTIAL, request),
  setCredential: (request: SetCredentialRequest) =>
    invoke<SetCredentialRequest, SetCredentialResponse>(SET_CREDENTIAL, request),
  deleteCredential: (request: DeleteCredentialRequest) =>
    invoke<DeleteCredentialRequest, DeleteCredentialResponse>(DELETE_CREDENTIAL, request),
  getTavilySettings: (request: GetTavilySettingsRequest = {}) =>
    invoke<GetTavilySettingsRequest, GetTavilySettingsResponse>(GET_TAVILY_SETTINGS, request),
  setTavilyApiKey: (request: SetTavilyApiKeyRequest) =>
    invoke<SetTavilyApiKeyRequest, SetTavilyApiKeyResponse>(SET_TAVILY_API_KEY, request),
  deleteTavilyApiKey: (request: DeleteTavilyApiKeyRequest = {}) =>
    invoke<DeleteTavilyApiKeyRequest, DeleteTavilyApiKeyResponse>(DELETE_TAVILY_API_KEY, request),
  getUserConfig: (request: GetUserConfigRequest = {}) =>
    invoke<GetUserConfigRequest, GetUserConfigResponse>(GET_USER_CONFIG, request),
  setUserConfig: (request: SetUserConfigRequest) =>
    invoke<SetUserConfigRequest, SetUserConfigResponse>(SET_USER_CONFIG, request),
  createSession: (request: CreateSessionRequest) =>
    invoke<CreateSessionRequest, CreateSessionResponse>(CREATE_SESSION, request),
  getSessionList: (request: GetSessionListRequest) =>
    invoke<GetSessionListRequest, GetSessionListResponse>(GET_SESSION_LIST, request),
  getSkillList: (request: GetSkillListRequest) =>
    invoke<GetSkillListRequest, GetSkillListResponse>(GET_SKILL_LIST, request),
  getBuiltinSkillList: (request: GetBuiltinSkillListRequest = {}) =>
    invoke<GetBuiltinSkillListRequest, GetBuiltinSkillListResponse>(
      GET_BUILTIN_SKILL_LIST,
      request,
    ),
  setBuiltinSkillEnabled: (request: SetBuiltinSkillEnabledRequest) =>
    invoke<SetBuiltinSkillEnabledRequest, SetBuiltinSkillEnabledResponse>(
      SET_BUILTIN_SKILL_ENABLED,
      request,
    ),
  searchFiles: (request: SearchFilesRequest) =>
    invoke<SearchFilesRequest, SearchFilesResponse>(SEARCH_FILES, request),
  sendMessage: (request: SendMessageRequest) =>
    invoke<SendMessageRequest, SendMessageResponse>(SEND_MESSAGE, request),
  stopMessage: (request: StopMessageRequest) =>
    invoke<StopMessageRequest, StopMessageResponse>(STOP_MESSAGE, request),
  getMessageList: (request: GetMessageListRequest) =>
    invoke<GetMessageListRequest, GetMessageListResponse>(GET_MESSAGE_LIST, request),
  resolveToolApproval: (request: ResolveToolApprovalRequest) =>
    invoke<ResolveToolApprovalRequest, ResolveToolApprovalResponse>(RESOLVE_TOOL_APPROVAL, request),
  getWorkspaceList: (request: GetWorkspaceListRequest) =>
    invoke<GetWorkspaceListRequest, GetWorkspaceListResponse>(GET_WORKSPACE_LIST, request),
  createWorkspace: (request: CreateWorkspaceRequest) =>
    invoke<CreateWorkspaceRequest, CreateWorkspaceResponse>(CREATE_WORKSPACE, request),
  selectWorkspaceDirectory: (request: SelectWorkspaceDirectoryRequest = {}) =>
    invoke<SelectWorkspaceDirectoryRequest, SelectWorkspaceDirectoryResponse>(
      SELECT_WORKSPACE_DIRECTORY,
      request,
    ),
  setWorkspacePinned: (request: SetWorkspacePinnedRequest) =>
    invoke<SetWorkspacePinnedRequest, SetWorkspacePinnedResponse>(SET_WORKSPACE_PINNED, request),
  renameWorkspace: (request: RenameWorkspaceRequest) =>
    invoke<RenameWorkspaceRequest, RenameWorkspaceResponse>(RENAME_WORKSPACE, request),
  deleteWorkspace: (request: DeleteWorkspaceRequest) =>
    invoke<DeleteWorkspaceRequest, DeleteWorkspaceResponse>(DELETE_WORKSPACE, request),
  onEventBus: (callback: (event: string, data: any) => void) => {
    ipcRenderer.on(
      EVENT_BUS,
      (_event: IpcRendererEvent, { event, data }: { event: string; data: any }) => {
        callback(event, data);
      },
    );
  },
};

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
