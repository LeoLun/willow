import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import type { IRenderHook } from "../shared";
import type {
  ApiResponse,
  DeleteCredentialRequest,
  DeleteCredentialResponse,
  GetAppInfoRequest,
  GetAppInfoResponse,
  GetCredentialRequest,
  GetCredentialResponse,
  GetProviderCatalogRequest,
  GetProviderCatalogResponse,
  RegisterEventRequest,
  RegisterEventResponse,
  SetCredentialRequest,
  SetCredentialResponse,
} from "../shared/api";
import {
  DELETE_CREDENTIAL,
  EVENT_BUS,
  GET_APP_INFO,
  GET_CREDENTIAL,
  GET_PROVIDER_CATALOG,
  REGISTER_EVENT,
  SET_CREDENTIAL,
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
  getProviderCatalog: (request: GetProviderCatalogRequest = {}) =>
    invoke<GetProviderCatalogRequest, GetProviderCatalogResponse>(GET_PROVIDER_CATALOG, request),
  getCredential: (request: GetCredentialRequest) =>
    invoke<GetCredentialRequest, GetCredentialResponse>(GET_CREDENTIAL, request),
  setCredential: (request: SetCredentialRequest) =>
    invoke<SetCredentialRequest, SetCredentialResponse>(SET_CREDENTIAL, request),
  deleteCredential: (request: DeleteCredentialRequest) =>
    invoke<DeleteCredentialRequest, DeleteCredentialResponse>(DELETE_CREDENTIAL, request),
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
