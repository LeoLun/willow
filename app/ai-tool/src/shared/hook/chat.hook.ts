import { AIMessageChunk } from "@langchain/core/messages";
import type { BillRecord } from "../index";

export type IStartAiStreamResponce = {
  result: string;
}

export interface IStartAiStreamRequest {
  id: string;
  messages: string;
}

export interface ICreateChatSessionResponce {
  id: string;
}

export interface IOnAiStreamRequest {
  id: string;
  callback: (data: AIMessageChunk) => void
}

export interface IOnAiStreamResponse {
  id: string;
  data: AIMessageChunk;
}

export type IStartAiRenameResponce = {
  result: string;
}

export type IAiRenameRecommendRequest = {
  filePath: string;
}

export type IAiRenameRecommendResponce =
  | { result: 'success'; filePath: string; recommendations: string[] }
  | { result: 'canceled' }
  | { result: 'error'; error: string };

export type IAiRenameApplyRequest = {
  filePath: string;
  newBaseName: string; // 不含扩展名
}

export type IAiRenameApplyResponce =
  | { result: 'success'; oldPath: string; newPath: string }
  | { result: 'error'; error: string };

export type IStartImportToNotionResponce = {
  result: string;
}

export type IParseBillFileResponce = {
  result: 'success' | 'error';
  jobId?: string;
  total?: number;
  error?: string;
}

export type IAiClassifyBillResponce = {
  result: 'success' | 'error';
  jobId?: string;
  total?: number;
  error?: string;
}

export type IUploadBillToNotionResponce = {
  result: 'success' | 'error';
  uploaded?: number;
  skipped?: number;
  error?: string;
}

export type IAiClassifyDonePayload = {
  jobId: string;
  total: number;
}

export type IUploadBillProgressPayload = {
  jobId: string;
  current: number;
  total: number;
  uploaded: number;
  skipped: number;
  billId: string;
  stage: 'start' | 'done';
  action?: 'uploaded' | 'skipped';
}

export interface IChatHookWindow {
  createChatSession(event:  Electron.IpcMainInvokeEvent): Promise<ICreateChatSessionResponce>;
  startAiStream(event:  Electron.IpcMainInvokeEvent, request: IStartAiStreamRequest): Promise<IStartAiStreamResponce>;
  aiRename(event:  Electron.IpcMainInvokeEvent): Promise<IStartAiRenameResponce>;
  aiRenameRecommend(event: Electron.IpcMainInvokeEvent, request: IAiRenameRecommendRequest): Promise<IAiRenameRecommendResponce>;
  aiRenameApply(event: Electron.IpcMainInvokeEvent, request: IAiRenameApplyRequest): Promise<IAiRenameApplyResponce>;
  importToNotion(event:  Electron.IpcMainInvokeEvent): Promise<IStartImportToNotionResponce>;
  parseBillFile(event: Electron.IpcMainInvokeEvent, filePath: string): Promise<IParseBillFileResponce>;
  aiClassifyBill(event: Electron.IpcMainInvokeEvent, jobId: string): Promise<IAiClassifyBillResponce>;
  uploadBillToNotion(event: Electron.IpcMainInvokeEvent, jobId: string): Promise<IUploadBillToNotionResponce>;
}


export interface IChatHookRenderer {
  onAiStream(request: IOnAiStreamRequest): void;
  createChatSession(): Promise<ICreateChatSessionResponce>;
  startAiStream(request: IStartAiStreamRequest): Promise<IStartAiStreamResponce>;
  aiRename(): Promise<IStartAiRenameResponce>;
  aiRenameRecommend(request: IAiRenameRecommendRequest): Promise<IAiRenameRecommendResponce>;
  aiRenameApply(request: IAiRenameApplyRequest): Promise<IAiRenameApplyResponce>;
  importToNotion(filePath?: string): Promise<IStartImportToNotionResponce>;
  parseBillFile(filePath: string): Promise<IParseBillFileResponce>;
  aiClassifyBill(jobId: string): Promise<IAiClassifyBillResponce>;
  uploadBillToNotion(jobId: string): Promise<IUploadBillToNotionResponce>;
  onParseBillResult(callback: (billList: BillRecord[]) => void): void;
  onUpdateBill(callback: (bill: BillRecord) => void): void;
  onAiClassifyDone(callback: (payload: IAiClassifyDonePayload) => void): void;
  onUploadBillProgress(callback: (payload: IUploadBillProgressPayload) => void): void;
}
