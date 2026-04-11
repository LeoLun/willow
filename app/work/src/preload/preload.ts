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
  RenameWorkspaceRequest,
  RenameWorkspaceResponse,
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
  RegisterEventRequest,
  RegisterEventResponse,
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
  GetAutomationListResponse,
  GetAutomationRequest,
  GetAutomationResponse,
  CreateAutomationRequest,
  CreateAutomationResponse,
  UpdateAutomationRequest,
  UpdateAutomationResponse,
  DeleteAutomationRequest,
  DeleteAutomationResponse,
} from "../shared/api";
import {
  GET_WORKSPACE_LIST,
  CREATE_WORKSPACE,
  DELETE_WORKSPACE,
  GET_WORKSPACE_INFO,
  RENAME_WORKSPACE,
  CREATE_SESSION,
  RENAME_SESSION,
  DELETE_SESSION,
  SEND_MESSAGE,
  RESOLVE_TOOL_APPROVAL,
  STOP_SESSION_STREAM,
  GET_SESSION_LIST,
  GET_SESSION_HISTORY,
  GET_WORKSPACE_SESSIONS,
  REGISTER_EVENT,
  EVENT_BUS,
  GET_MODEL_LIST,
  ADD_MODEL,
  UPDATE_MODEL,
  DELETE_MODEL,
  SET_DEFAULT_MODEL,
  GET_TAVILY_KEY_LIST,
  ADD_TAVILY_KEY,
  UPDATE_TAVILY_KEY,
  DELETE_TAVILY_KEY,
  GET_AUTOMATION_LIST,
  GET_AUTOMATION,
  CREATE_AUTOMATION,
  UPDATE_AUTOMATION,
  DELETE_AUTOMATION,
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
  addModel: async (request: AddModelRequest) => {
    const response = (await ipcRenderer.invoke(
      ADD_MODEL,
      request,
    )) as ApiResponse<AddModelResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("add model failed");
    }
    return response.data;
  },
  updateModel: async (request: UpdateModelRequest) => {
    const response = (await ipcRenderer.invoke(
      UPDATE_MODEL,
      request,
    )) as ApiResponse<UpdateModelResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("update model failed");
    }
    return response.data;
  },
  deleteModel: async (request: DeleteModelRequest) => {
    const response = (await ipcRenderer.invoke(
      DELETE_MODEL,
      request,
    )) as ApiResponse<DeleteModelResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
    }
    if (!response.data) {
      throw new Error("delete model failed");
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
};

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
