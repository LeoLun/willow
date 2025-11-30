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

export type IStartImportToNotionResponce = {
  result: string;
}

export interface IChatHookWindow {
  createChatSession(event:  Electron.IpcMainInvokeEvent): Promise<ICreateChatSessionResponce>;
  startAiStream(event:  Electron.IpcMainInvokeEvent, request: IStartAiStreamRequest): Promise<IStartAiStreamResponce>;
  aiRename(event:  Electron.IpcMainInvokeEvent): Promise<IStartAiRenameResponce>;
  importToNotion(event:  Electron.IpcMainInvokeEvent): Promise<IStartImportToNotionResponce>;
}


export interface IChatHookRenderer {
  onAiStream(request: IOnAiStreamRequest): void;
  createChatSession(): Promise<ICreateChatSessionResponce>;
  startAiStream(request: IStartAiStreamRequest): Promise<IStartAiStreamResponce>;
  aiRename(): Promise<IStartAiRenameResponce>;
  importToNotion(filePath?: string): Promise<IStartImportToNotionResponce>;
  onParseBillResult(callback: (billList: BillRecord[]) => void): void;
  onUpdateBill(callback: (bill: BillRecord) => void): void;
}
