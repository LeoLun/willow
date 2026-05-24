import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { IRenderHook } from "../shared";
import type {
  ApiResponse,
  GetWorkspaceListResponse,
  CreateWorkspaceRequest,
  CreateWorkspaceResponse,
  DeleteWorkspaceRequest,
  DeleteWorkspaceResponse,
  GetWorkspaceInfoRequest,
  GetWorkspaceInfoResponse,
  GetWorkspaceFilesRequest,
  GetWorkspaceFilesResponse,
  GetWorkspaceSettingsRequest,
  GetWorkspaceSettingsResponse,
  GetAvailableSkillsRequest,
  GetAvailableSkillsResponse,
  GetWorkspaceAgentsResponse,
  OpenPathRequest,
  OpenPathResponse,
  SelectFilesRequest,
  SelectFilesResponse,
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
  UpdateWorkspaceSettingsRequest,
  UpdateWorkspaceSettingsResponse,
  CreateSessionRequest,
  CreateSessionResponse,
  RenameSessionRequest,
  RenameSessionResponse,
  DeleteSessionRequest,
  DeleteSessionResponse,
  SendMessageRequest,
  SendMessageResponse,
  ResolveToolApprovalRequest,
  ResolveToolApprovalResponse,
  StopSessionStreamRequest,
  StopSessionStreamResponse,
  GetSessionListRequest,
  GetSessionListResponse,
  GetSessionHistoryRequest,
  GetSessionHistoryResponse,
  GetWorkspaceSessionsRequest,
  GetWorkspaceSessionsResponse,
  GetConversationSessionRequest,
  GetConversationSessionResponse,
  RegisterEventRequest,
  RegisterEventResponse,
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
  GetAutomationListResponse,
  GetAutomationRequest,
  GetAutomationResponse,
  CreateAutomationRequest,
  CreateAutomationResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
  RunAutomationNowRequest,
  RunAutomationNowResponse,
  DeleteAutomationRequest,
  DeleteAutomationResponse,
  AiAppLoadRequest,
  AiAppBoundsRequest,
  GetFloatingBallConfigResponse,
  MoveFloatingBallWindowRequest,
  SetFloatingBallEnabledRequest,
  SetFloatingBallPositionRequest,
  ResizeFloatingBallWindowRequest,
  ResizeFloatingBallWindowResponse,
  CheckUpdateResponse,
  StartDownloadResponse,
  InstallUpdateResponse,
} from "../shared/api";
import {
  GET_WORKSPACE_LIST,
  CREATE_WORKSPACE,
  DELETE_WORKSPACE,
  GET_WORKSPACE_INFO,
  GET_WORKSPACE_FILES,
  GET_WORKSPACE_SETTINGS,
  GET_AVAILABLE_SKILLS,
  GET_WORKSPACE_AGENTS,
  OPEN_PATH,
  RENAME_WORKSPACE,
  SELECT_DIRECTORY,
  SELECT_FILES,
  UPDATE_WORKSPACE_SETTINGS,
  CREATE_SESSION,
  RENAME_SESSION,
  DELETE_SESSION,
  SEND_MESSAGE,
  RESOLVE_TOOL_APPROVAL,
  STOP_SESSION_STREAM,
  GET_SESSION_LIST,
  GET_SESSION_HISTORY,
  GET_WORKSPACE_SESSIONS,
  GET_CONVERSATION_SESSION,
  REGISTER_EVENT,
  EVENT_BUS,
  GET_MODEL_LIST,
  SET_DEEPSEEK_API_KEY,
  SET_DEFAULT_MODEL,
  GET_TAVILY_KEY_LIST,
  ADD_TAVILY_KEY,
  UPDATE_TAVILY_KEY,
  DELETE_TAVILY_KEY,
  GET_AUTOMATION_LIST,
  GET_AUTOMATION,
  CREATE_AUTOMATION,
  UPDATE_AUTOMATION,
  RUN_AUTOMATION_NOW,
  DELETE_AUTOMATION,
  AI_APP_LOAD,
  AI_APP_BOUNDS,
  AI_APP_CLOSE,
  GET_FLOATING_BALL_CONFIG,
  MOVE_FLOATING_BALL_WINDOW,
  SET_FLOATING_BALL_ENABLED,
  SET_FLOATING_BALL_POSITION,
  SHOW_MAIN_WINDOW,
  SHOW_FLOATING_BALL_MENU,
  RESIZE_FLOATING_BALL_WINDOW,
  CHECK_UPDATE,
  START_DOWNLOAD,
  INSTALL_UPDATE,
} from "../shared/constants";

const ipcObject: IRenderHook = {
  getWorkspaceList: async () => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_LIST,
    )) as ApiResponse<GetWorkspaceListResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get workspace list failed");
    }
    return response.data;
  },
  createWorkspace: async (request: CreateWorkspaceRequest) => {
    const response = (await ipcRenderer.invoke(
      CREATE_WORKSPACE,
      request,
    )) as ApiResponse<CreateWorkspaceResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("create workspace failed");
    }
    return response.data;
  },
  deleteWorkspace: async (request: DeleteWorkspaceRequest) => {
    const response = (await ipcRenderer.invoke(
      DELETE_WORKSPACE,
      request,
    )) as ApiResponse<DeleteWorkspaceResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("delete workspace failed");
    }
    return response.data;
  },
  getWorkspaceInfo: async (request: GetWorkspaceInfoRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_INFO,
      request,
    )) as ApiResponse<GetWorkspaceInfoResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get workspace info failed");
    }
    return response.data;
  },
  getWorkspaceFiles: async (request: GetWorkspaceFilesRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_FILES,
      request,
    )) as ApiResponse<GetWorkspaceFilesResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get workspace files failed");
    }
    return response.data;
  },
  getWorkspaceSettings: async (request: GetWorkspaceSettingsRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_SETTINGS,
      request,
    )) as ApiResponse<GetWorkspaceSettingsResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get workspace settings failed");
    }
    return response.data;
  },
  getAvailableSkills: async (request: GetAvailableSkillsRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_AVAILABLE_SKILLS,
      request,
    )) as ApiResponse<GetAvailableSkillsResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get available skills failed");
    }
    return response.data;
  },
  getWorkspaceAgents: async () => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_AGENTS,
      {},
    )) as ApiResponse<GetWorkspaceAgentsResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get workspace agents failed");
    }
    return response.data;
  },
  renameWorkspace: async (request: RenameWorkspaceRequest) => {
    const response = (await ipcRenderer.invoke(
      RENAME_WORKSPACE,
      request,
    )) as ApiResponse<RenameWorkspaceResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("rename workspace failed");
    }
    return response.data;
  },
  updateWorkspaceSettings: async (request: UpdateWorkspaceSettingsRequest) => {
    const response = (await ipcRenderer.invoke(
      UPDATE_WORKSPACE_SETTINGS,
      request,
    )) as ApiResponse<UpdateWorkspaceSettingsResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("update workspace settings failed");
    }
    return response.data;
  },
  selectDirectory: async (defaultPath?: string) => {
    return ipcRenderer.invoke(SELECT_DIRECTORY, defaultPath);
  },
  selectFiles: async (request?: SelectFilesRequest) => {
    const response = (await ipcRenderer.invoke(
      SELECT_FILES,
      request,
    )) as ApiResponse<SelectFilesResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("select files failed");
    }
    return response.data;
  },
  openPath: async (request: OpenPathRequest) => {
    const response = (await ipcRenderer.invoke(
      OPEN_PATH,
      request,
    )) as ApiResponse<OpenPathResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("open path failed");
    }
    return response.data;
  },
  createSession: async (request: CreateSessionRequest) => {
    const response = (await ipcRenderer.invoke(
      CREATE_SESSION,
      request,
    )) as ApiResponse<CreateSessionResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("create session failed");
    }
    return response.data;
  },
  renameSession: async (request: RenameSessionRequest) => {
    const response = (await ipcRenderer.invoke(
      RENAME_SESSION,
      request,
    )) as ApiResponse<RenameSessionResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("rename session failed");
    }
    return response.data;
  },
  deleteSession: async (request: DeleteSessionRequest) => {
    const response = (await ipcRenderer.invoke(
      DELETE_SESSION,
      request,
    )) as ApiResponse<DeleteSessionResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("delete session failed");
    }
    return response.data;
  },
  sendMessage: async (request: SendMessageRequest) => {
    const response = (await ipcRenderer.invoke(
      SEND_MESSAGE,
      request,
    )) as ApiResponse<SendMessageResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("send message failed");
    }
    return response.data;
  },
  resolveToolApproval: async (request: ResolveToolApprovalRequest) => {
    const response = (await ipcRenderer.invoke(
      RESOLVE_TOOL_APPROVAL,
      request,
    )) as ApiResponse<ResolveToolApprovalResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("resolve tool approval failed");
    }
    return response.data;
  },
  stopSessionStream: async (request: StopSessionStreamRequest) => {
    const response = (await ipcRenderer.invoke(
      STOP_SESSION_STREAM,
      request,
    )) as ApiResponse<StopSessionStreamResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("stop session stream failed");
    }
    return response.data;
  },
  getSessionList: async (request: GetSessionListRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_SESSION_LIST,
      request,
    )) as ApiResponse<GetSessionListResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get session list failed");
    }
    return response.data;
  },
  getSessionHistory: async (request: GetSessionHistoryRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_SESSION_HISTORY,
      request,
    )) as ApiResponse<GetSessionHistoryResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get session history failed");
    }
    return response.data;
  },
  getWorkspaceSessions: async (request: GetWorkspaceSessionsRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_SESSIONS,
      request,
    )) as ApiResponse<GetWorkspaceSessionsResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get workspace sessions failed");
    }
    return response.data;
  },
  getConversationSession: async (request?: GetConversationSessionRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_CONVERSATION_SESSION,
      request,
    )) as ApiResponse<GetConversationSessionResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get conversation session failed");
    }
    return response.data;
  },
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
  onEventBus: (callback: (event: string, data: any) => void) => {
    ipcRenderer.on(
      EVENT_BUS,
      (_event: IpcRendererEvent, { event, data }: { event: string; data: any }) => {
        callback(event, data);
      },
    );
  },
  getModelList: async () => {
    const response = (await ipcRenderer.invoke(
      GET_MODEL_LIST,
    )) as ApiResponse<GetModelListResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get model list failed");
    }
    return response.data;
  },
  setDeepSeekApiKey: async (request: SetDeepSeekApiKeyRequest) => {
    const response = (await ipcRenderer.invoke(
      SET_DEEPSEEK_API_KEY,
      request,
    )) as ApiResponse<SetDeepSeekApiKeyResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("set deepseek api key failed");
    }
    return response.data;
  },
  setDefaultModel: async (request: SetDefaultModelRequest) => {
    const response = (await ipcRenderer.invoke(
      SET_DEFAULT_MODEL,
      request,
    )) as ApiResponse<SetDefaultModelResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("set default model failed");
    }
    return response.data;
  },
  getTavilyKeyList: async () => {
    const response = (await ipcRenderer.invoke(
      GET_TAVILY_KEY_LIST,
    )) as ApiResponse<GetTavilyKeyListResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get tavily key list failed");
    }
    return response.data;
  },
  addTavilyKey: async (request: AddTavilyKeyRequest) => {
    const response = (await ipcRenderer.invoke(
      ADD_TAVILY_KEY,
      request,
    )) as ApiResponse<AddTavilyKeyResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("add tavily key failed");
    }
    return response.data;
  },
  updateTavilyKey: async (request: UpdateTavilyKeyRequest) => {
    const response = (await ipcRenderer.invoke(
      UPDATE_TAVILY_KEY,
      request,
    )) as ApiResponse<UpdateTavilyKeyResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("update tavily key failed");
    }
    return response.data;
  },
  deleteTavilyKey: async (request: DeleteTavilyKeyRequest) => {
    const response = (await ipcRenderer.invoke(
      DELETE_TAVILY_KEY,
      request,
    )) as ApiResponse<DeleteTavilyKeyResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("delete tavily key failed");
    }
    return response.data;
  },
  getAutomationList: async () => {
    const response = (await ipcRenderer.invoke(
      GET_AUTOMATION_LIST,
    )) as ApiResponse<GetAutomationListResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get automation list failed");
    }
    return response.data;
  },
  getAutomation: async (request: GetAutomationRequest) => {
    const response = (await ipcRenderer.invoke(
      GET_AUTOMATION,
      request,
    )) as ApiResponse<GetAutomationResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("get automation failed");
    }
    return response.data;
  },
  createAutomation: async (request: CreateAutomationRequest) => {
    const response = (await ipcRenderer.invoke(
      CREATE_AUTOMATION,
      request,
    )) as ApiResponse<CreateAutomationResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("create automation failed");
    }
    return response.data;
  },
  updateAutomation: async (request: UpdateAutomationRequest) => {
    const response = (await ipcRenderer.invoke(
      UPDATE_AUTOMATION,
      request,
    )) as ApiResponse<UpdateAutomationResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("update automation failed");
    }
    return response.data;
  },
  runAutomationNow: async (request: RunAutomationNowRequest) => {
    const response = (await ipcRenderer.invoke(
      RUN_AUTOMATION_NOW,
      request,
    )) as ApiResponse<RunAutomationNowResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("run automation now failed");
    }
    return response.data;
  },
  deleteAutomation: async (request: DeleteAutomationRequest) => {
    const response = (await ipcRenderer.invoke(
      DELETE_AUTOMATION,
      request,
    )) as ApiResponse<DeleteAutomationResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("delete automation failed");
    }
    return response.data;
  },
  loadAiApp: async (request: AiAppLoadRequest) => {
    const response = (await ipcRenderer.invoke(AI_APP_LOAD, request)) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  updateAiAppBounds: async (request: AiAppBoundsRequest) => {
    const response = (await ipcRenderer.invoke(AI_APP_BOUNDS, request)) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  closeAiApp: async () => {
    const response = (await ipcRenderer.invoke(AI_APP_CLOSE)) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  getFloatingBallConfig: async () => {
    const response = (await ipcRenderer.invoke(
      GET_FLOATING_BALL_CONFIG,
    )) as ApiResponse<GetFloatingBallConfigResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    return response.data!;
  },
  setFloatingBallEnabled: async (request: SetFloatingBallEnabledRequest) => {
    const response = (await ipcRenderer.invoke(
      SET_FLOATING_BALL_ENABLED,
      request,
    )) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  setFloatingBallPosition: async (request: SetFloatingBallPositionRequest) => {
    const response = (await ipcRenderer.invoke(
      SET_FLOATING_BALL_POSITION,
      request,
    )) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  moveFloatingBallWindow: async (request: MoveFloatingBallWindowRequest) => {
    const response = (await ipcRenderer.invoke(
      MOVE_FLOATING_BALL_WINDOW,
      request,
    )) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  showMainWindow: async () => {
    const response = (await ipcRenderer.invoke(SHOW_MAIN_WINDOW)) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  showFloatingBallMenu: async () => {
    const response = (await ipcRenderer.invoke(SHOW_FLOATING_BALL_MENU)) as ApiResponse<void>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
  },
  resizeFloatingBallWindow: async (request: ResizeFloatingBallWindowRequest) => {
    const response = (await ipcRenderer.invoke(
      RESIZE_FLOATING_BALL_WINDOW,
      request,
    )) as ApiResponse<ResizeFloatingBallWindowResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("resize floating ball window failed");
    }
    return response.data;
  },
  checkUpdate: async (request?: { force?: boolean }) => {
    const response = (await ipcRenderer.invoke(
      CHECK_UPDATE,
      request,
    )) as ApiResponse<CheckUpdateResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("check update failed");
    }
    return response.data;
  },
  startDownload: async () => {
    const response = (await ipcRenderer.invoke(
      START_DOWNLOAD,
    )) as ApiResponse<StartDownloadResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("start download failed");
    }
    return response.data;
  },
  installUpdate: async () => {
    const response = (await ipcRenderer.invoke(
      INSTALL_UPDATE,
    )) as ApiResponse<InstallUpdateResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("install update failed");
    }
    return response.data;
  },
};

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
