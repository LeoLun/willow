import { AIMessageChunk } from "@langchain/core/messages";
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

export interface IChatHookWindow {
  createChatSession(event:  Electron.IpcMainInvokeEvent): Promise<ICreateChatSessionResponce>;
  startAiStream(event:  Electron.IpcMainInvokeEvent, request: IStartAiStreamRequest): Promise<IStartAiStreamResponce>;
  aiRename(event:  Electron.IpcMainInvokeEvent): Promise<IStartAiRenameResponce>;
}

export type IStartAiRenameResponce = {
  result: string;
}


export interface IChatHookRenderer {
  onAiStream(request: IOnAiStreamRequest): void;
  createChatSession(): Promise<ICreateChatSessionResponce>;
  startAiStream(request: IStartAiStreamRequest): Promise<IStartAiStreamResponce>;
  // 获取对话列表
  // 新增对话
  // 删除对话
  // 修改对话标题
  // 获取对话详情
  aiRename(): Promise<IStartAiRenameResponce>;
}
