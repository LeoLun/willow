import { contextBridge, ipcRenderer, webUtils } from "electron";
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
  IStartImportToNotionResponce,
  BillRecord,
} from "../shared";

import {
  AI_RENAME,
  AI_STREAM,
  CREATE_CHAT_SESSION,
  OPEN_SETTING_WINDOW,
  SET_THEME,
  START_AI_STREAM,
  AI_IMPORT_TO_NOTION,
  PARSE_BILL_RESULT,
  UPADTA_BILL,
} from "../shared";


const  renderHookImpl: IRenderHook  = {
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
  async importToNotion(filePath?: string): Promise<IStartImportToNotionResponce> {
    return await ipcRenderer.invoke(AI_IMPORT_TO_NOTION, filePath);
  },
  getFilePath: (file: File) => {
    // webUtils.getPathForFile 是获取真实路径的官方方法
    return webUtils.getPathForFile(file);
  },
  onParseBillResult: (callback: (billList: BillRecord[]) => void) => {
    ipcRenderer.on(PARSE_BILL_RESULT, (event, billList) => {
      callback(billList);
    });
  },
  onUpdateBill: (callback: (bill: BillRecord) => void) => {
    ipcRenderer.on(UPADTA_BILL, (event, bill) => {
      callback(bill);
    });
  },
}

contextBridge.exposeInMainWorld("electronAPI", renderHookImpl);
