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
  IAiRenameRecommendRequest,
  IAiRenameRecommendResponce,
  IAiRenameApplyRequest,
  IAiRenameApplyResponce,
  IStartImportToNotionResponce,
  IParseBillFileResponce,
  IAiClassifyBillResponce,
  IUploadBillToNotionResponce,
  IAiClassifyDonePayload,
  IUploadBillProgressPayload,
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
  PARSE_BILL_FILE,
  AI_CLASSIFY_BILL,
  AI_CLASSIFY_DONE,
  UPLOAD_BILL_TO_NOTION,
  UPLOAD_BILL_PROGRESS,
  AI_RENAME_RECOMMEND,
  AI_RENAME_APPLY,
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
  async aiRenameRecommend(request: IAiRenameRecommendRequest): Promise<IAiRenameRecommendResponce> {
    return await ipcRenderer.invoke(AI_RENAME_RECOMMEND, request);
  },
  async aiRenameApply(request: IAiRenameApplyRequest): Promise<IAiRenameApplyResponce> {
    return await ipcRenderer.invoke(AI_RENAME_APPLY, request);
  },
  async importToNotion(filePath?: string): Promise<IStartImportToNotionResponce> {
    return await ipcRenderer.invoke(AI_IMPORT_TO_NOTION, filePath);
  },
  async parseBillFile(filePath: string): Promise<IParseBillFileResponce> {
    return await ipcRenderer.invoke(PARSE_BILL_FILE, filePath);
  },
  async aiClassifyBill(jobId: string): Promise<IAiClassifyBillResponce> {
    return await ipcRenderer.invoke(AI_CLASSIFY_BILL, jobId);
  },
  async uploadBillToNotion(jobId: string): Promise<IUploadBillToNotionResponce> {
    return await ipcRenderer.invoke(UPLOAD_BILL_TO_NOTION, jobId);
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
  onAiClassifyDone: (callback: (payload: IAiClassifyDonePayload) => void) => {
    ipcRenderer.on(AI_CLASSIFY_DONE, (event, payload) => {
      callback(payload);
    });
  },
  onUploadBillProgress: (callback: (payload: IUploadBillProgressPayload) => void) => {
    ipcRenderer.on(UPLOAD_BILL_PROGRESS, (event, payload) => {
      callback(payload);
    });
  },
}

contextBridge.exposeInMainWorld("electronAPI", renderHookImpl);
