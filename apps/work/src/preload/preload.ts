import { contextBridge, ipcRenderer, type IpcRendererEvent, webUtils } from "electron";
import type { IRenderHook } from "../shared";
import type {
  ApiResponse,
  AppUpdateRequest,
  AppUpdateResponse,
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
  GetAutoLaunchRequest,
  GetAutoLaunchResponse,
  GetAppInfoRequest,
  GetAppInfoResponse,
  GetBoardPanelRequest,
  GetBoardPanelResponse,
  GetBuiltinSkillListRequest,
  GetBuiltinSkillListResponse,
  GetConfiguredProvidersRequest,
  GetConfiguredProvidersResponse,
  GetCredentialRequest,
  GetCredentialResponse,
  GetMessageListRequest,
  GetMessageListResponse,
  InspectLocalFilesRequest,
  InspectLocalFilesResponse,
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
  ListWorkspaceDirectoryRequest,
  ListWorkspaceDirectoryResponse,
  RegisterEventRequest,
  RegisterEventResponse,
  ReadWorkspaceFileRequest,
  ReadWorkspaceFileResponse,
  RevealWorkspaceEntryRequest,
  RevealWorkspaceEntryResponse,
  RestartToUpdateResponse,
  OpenManualUpdateResponse,
  OpenWorkspaceFileRequest,
  OpenWorkspaceFileResponse,
  OpenWorkspaceDirectoryRequest,
  OpenWorkspaceDirectoryResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse,
  ResolveUserQuestionRequest,
  ResolveUserQuestionResponse,
  SearchFilesRequest,
  SearchFilesResponse,
  SelectLocalFilesRequest,
  SelectLocalFilesResponse,
  SendMessageRequest,
  SendMessageResponse,
  SetCredentialRequest,
  SetCredentialResponse,
  SetBuiltinSkillEnabledRequest,
  SetBuiltinSkillEnabledResponse,
  SetAutoLaunchRequest,
  SetAutoLaunchResponse,
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
  SubscribeWorkspaceFilesRequest,
  SubscribeWorkspaceFilesResponse,
  UnsubscribeWorkspaceFilesRequest,
  UnsubscribeWorkspaceFilesResponse,
} from "../shared/api";
import {
  CREATE_SESSION,
  CHECK_APP_UPDATE,
  CONFIRM_UPDATE_BOOT,
  DELETE_CREDENTIAL,
  DELETE_TAVILY_API_KEY,
  CREATE_WORKSPACE,
  DELETE_WORKSPACE,
  EVENT_BUS,
  DOWNLOAD_APP_UPDATE,
  GET_APP_INFO,
  GET_APP_UPDATE_STATE,
  GET_AUTO_LAUNCH,
  GET_BOARD_PANEL,
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
  LIST_WORKSPACE_DIRECTORY,
  REGISTER_EVENT,
  READ_WORKSPACE_FILE,
  REVEAL_WORKSPACE_ENTRY,
  OPEN_MANUAL_UPDATE,
  OPEN_WORKSPACE_FILE,
  OPEN_WORKSPACE_DIRECTORY,
  RENAME_WORKSPACE,
  RESOLVE_TOOL_APPROVAL,
  RESOLVE_USER_QUESTION,
  RESTART_TO_UPDATE,
  SEARCH_FILES,
  INSPECT_LOCAL_FILES,
  SEND_MESSAGE,
  SELECT_LOCAL_FILES,
  SET_CREDENTIAL,
  SET_BUILTIN_SKILL_ENABLED,
  SET_AUTO_LAUNCH,
  SET_THEME,
  SET_TAVILY_API_KEY,
  SET_USER_CONFIG,
  SELECT_WORKSPACE_DIRECTORY,
  SET_WORKSPACE_PINNED,
  STOP_MESSAGE,
  SUBSCRIBE_WORKSPACE_FILES,
  UNSUBSCRIBE_WORKSPACE_FILES,
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
  getUpdateState: (request: AppUpdateRequest = {}) =>
    invoke<AppUpdateRequest, AppUpdateResponse>(GET_APP_UPDATE_STATE, request),
  checkForUpdate: (request: AppUpdateRequest = {}) =>
    invoke<AppUpdateRequest, AppUpdateResponse>(CHECK_APP_UPDATE, request),
  downloadUpdate: (request: AppUpdateRequest = {}) =>
    invoke<AppUpdateRequest, AppUpdateResponse>(DOWNLOAD_APP_UPDATE, request),
  restartToUpdate: (request: AppUpdateRequest = {}) =>
    invoke<AppUpdateRequest, RestartToUpdateResponse>(RESTART_TO_UPDATE, request),
  openManualUpdate: (request: AppUpdateRequest = {}) =>
    invoke<AppUpdateRequest, OpenManualUpdateResponse>(OPEN_MANUAL_UPDATE, request),
  confirmUpdateBoot: (request: AppUpdateRequest = {}) =>
    invoke<AppUpdateRequest, AppUpdateResponse>(CONFIRM_UPDATE_BOOT, request),
  setTheme: (request: SetThemeRequest) =>
    invoke<SetThemeRequest, SetThemeResponse>(SET_THEME, request),
  getAutoLaunch: (request: GetAutoLaunchRequest = {}) =>
    invoke<GetAutoLaunchRequest, GetAutoLaunchResponse>(GET_AUTO_LAUNCH, request),
  setAutoLaunch: (request: SetAutoLaunchRequest) =>
    invoke<SetAutoLaunchRequest, SetAutoLaunchResponse>(SET_AUTO_LAUNCH, request),
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
  getBoardPanel: (request: GetBoardPanelRequest) =>
    invoke<GetBoardPanelRequest, GetBoardPanelResponse>(GET_BOARD_PANEL, request),
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
  listWorkspaceDirectory: (request: ListWorkspaceDirectoryRequest) =>
    invoke<ListWorkspaceDirectoryRequest, ListWorkspaceDirectoryResponse>(
      LIST_WORKSPACE_DIRECTORY,
      request,
    ),
  readWorkspaceFile: (request: ReadWorkspaceFileRequest) =>
    invoke<ReadWorkspaceFileRequest, ReadWorkspaceFileResponse>(READ_WORKSPACE_FILE, request),
  openWorkspaceFile: (request: OpenWorkspaceFileRequest) =>
    invoke<OpenWorkspaceFileRequest, OpenWorkspaceFileResponse>(OPEN_WORKSPACE_FILE, request),
  revealWorkspaceEntry: (request: RevealWorkspaceEntryRequest) =>
    invoke<RevealWorkspaceEntryRequest, RevealWorkspaceEntryResponse>(
      REVEAL_WORKSPACE_ENTRY,
      request,
    ),
  subscribeWorkspaceFiles: (request: SubscribeWorkspaceFilesRequest) =>
    invoke<SubscribeWorkspaceFilesRequest, SubscribeWorkspaceFilesResponse>(
      SUBSCRIBE_WORKSPACE_FILES,
      request,
    ),
  unsubscribeWorkspaceFiles: (request: UnsubscribeWorkspaceFilesRequest) =>
    invoke<UnsubscribeWorkspaceFilesRequest, UnsubscribeWorkspaceFilesResponse>(
      UNSUBSCRIBE_WORKSPACE_FILES,
      request,
    ),
  selectLocalFiles: (request: SelectLocalFilesRequest = {}) =>
    invoke<SelectLocalFilesRequest, SelectLocalFilesResponse>(SELECT_LOCAL_FILES, request),
  inspectLocalFiles: (request: InspectLocalFilesRequest) =>
    invoke<InspectLocalFilesRequest, InspectLocalFilesResponse>(INSPECT_LOCAL_FILES, request),
  getPathForFile: (file: File) => webUtils.getPathForFile(file),
  sendMessage: (request: SendMessageRequest) =>
    invoke<SendMessageRequest, SendMessageResponse>(SEND_MESSAGE, request),
  stopMessage: (request: StopMessageRequest) =>
    invoke<StopMessageRequest, StopMessageResponse>(STOP_MESSAGE, request),
  getMessageList: (request: GetMessageListRequest) =>
    invoke<GetMessageListRequest, GetMessageListResponse>(GET_MESSAGE_LIST, request),
  resolveToolApproval: (request: ResolveToolApprovalRequest) =>
    invoke<ResolveToolApprovalRequest, ResolveToolApprovalResponse>(RESOLVE_TOOL_APPROVAL, request),
  resolveUserQuestion: (request: ResolveUserQuestionRequest) =>
    invoke<ResolveUserQuestionRequest, ResolveUserQuestionResponse>(RESOLVE_USER_QUESTION, request),
  getWorkspaceList: (request: GetWorkspaceListRequest) =>
    invoke<GetWorkspaceListRequest, GetWorkspaceListResponse>(GET_WORKSPACE_LIST, request),
  createWorkspace: (request: CreateWorkspaceRequest) =>
    invoke<CreateWorkspaceRequest, CreateWorkspaceResponse>(CREATE_WORKSPACE, request),
  selectWorkspaceDirectory: (request: SelectWorkspaceDirectoryRequest = {}) =>
    invoke<SelectWorkspaceDirectoryRequest, SelectWorkspaceDirectoryResponse>(
      SELECT_WORKSPACE_DIRECTORY,
      request,
    ),
  openWorkspaceDirectory: (request: OpenWorkspaceDirectoryRequest) =>
    invoke<OpenWorkspaceDirectoryRequest, OpenWorkspaceDirectoryResponse>(
      OPEN_WORKSPACE_DIRECTORY,
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
