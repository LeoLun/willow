import { contextBridge, ipcRenderer } from "electron";
import type { IRenderHook } from "../shared";
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
  GET_SESSION_LIST,
} from "../shared/constants";
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
  GetSessionListRequest,
  GetSessionListResponse,
} from "../shared/api";

const ipcObject: IRenderHook = {
  getWorkspaceList: async () => {
    const response = (await ipcRenderer.invoke(
      GET_WORKSPACE_LIST,
    )) as ApiResponse<GetWorkspaceListResponse>;
    if (response.code !== 0) {
      throw new Error(response.msg);
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
    return response.data;
  },
};

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
