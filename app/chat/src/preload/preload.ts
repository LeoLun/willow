import { contextBridge, ipcRenderer } from "electron";
import type {
  IRenderHook,
  IOpenSettingWindowRequest,
  IOpenSettingWindowResponce,
  ISetTemeRequest,
  ISetTemeResponce,
  IStartAiStreamRequest,
  IStartAiStreamResponce,
  ICreateChatSessionResponce,
  IOnAiStreamRequest,
  IOnAiStreamResponse,
  IStartAiRenameResponce,
} from "../shared";

import {
  AI_RENAME,
  AI_STREAM,
  CREATE_CHAT_SESSION,
  OPEN_SETTING_WINDOW,
  SET_THEME,
  START_AI_STREAM,
} from "../shared";


const  ipcObject: IRenderHook  = {
  async createChatSession(): Promise<ICreateChatSessionResponce> {
    return await ipcRenderer.invoke(CREATE_CHAT_SESSION);
  },
  async openSettingWindow(request: IOpenSettingWindowRequest): Promise<IOpenSettingWindowResponce> {
    return await ipcRenderer.invoke(OPEN_SETTING_WINDOW, request);
  },
  async setTeme(request: ISetTemeRequest): Promise<ISetTemeResponce> {
    return await ipcRenderer.invoke(SET_THEME, request);
  },
  async startAiStream(request: IStartAiStreamRequest): Promise<IStartAiStreamResponce> {
    return await ipcRenderer.invoke(START_AI_STREAM, request);
  },
  onAiStream(request: IOnAiStreamRequest) {
    ipcRenderer.on(AI_STREAM, (event, rsp: IOnAiStreamResponse) => {
      if (rsp.id === request.id) {
        request.callback(rsp.data);
      }
    });
  },
  async aiRename(): Promise<IStartAiRenameResponce> {
    return await ipcRenderer.invoke(AI_RENAME);
  },
}

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
