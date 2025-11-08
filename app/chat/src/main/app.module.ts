import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { SomeService } from "./service/some.service";
import { MainWindow } from "./window/main.window";
import { SettingWindow } from "./window/setting.window";
import { app, BrowserWindow, dialog } from "electron";
import { ChatServiceFactory } from "./service/chat-service/chat-service.factory";
import { ChatServiceType } from "./interfaces/chat-service.interface";

import type {
  IOpenSettingWindowRequest,
  IOpenSettingWindowResponce,
  IOpenSettingWindow,
  IChatHookWindow,
  IStartAiStreamResponce,
  IStartAiStreamRequest,
  ICreateChatSessionResponce,
  IStartAiRenameResponce,
} from "../shared";

import {
  AI_RENAME,
  AI_STREAM,
  CREATE_CHAT_SESSION,
  OPEN_SETTING_WINDOW,
  START_AI_STREAM,
} from "../shared";

import { renameFileTool } from "./agent/rename.agent";



if (require("electron-squirrel-startup")) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow, SettingWindow],
  providers: [SomeService],
})
export class AppModule implements IOpenSettingWindow, IChatHookWindow {
  private windowFactoryResolver: WindowFactoryResolver;

  constructor(windowFactoryResolver: WindowFactoryResolver) {
    this.windowFactoryResolver = windowFactoryResolver;
  }

  createWindow() {
    this.windowFactoryResolver.resolveWindowFactory(MainWindow);
  }

  @On("ready")
  onReady() {
    this.createWindow();
  }

  @On("window-all-closed")
  onWindowAllClosed() {
    if (process.platform !== "darwin") {
      app.quit();
    }
  }

  @On("activate")
  onActivate() {
    if (BrowserWindow.getAllWindows().length === 0) {
      this.createWindow();
    }
  }

  @IPC(OPEN_SETTING_WINDOW)
  async openSettingWindow(
    event: Electron.IpcMainEvent,
    request: IOpenSettingWindowRequest
  ): Promise<IOpenSettingWindowResponce> {
    console.log("openSettingWindow", request);
    this.windowFactoryResolver.resolveWindowFactory(SettingWindow);
    return { result: "success" };
  }

  @IPC(START_AI_STREAM)
  async startAiStream(
    event: Electron.IpcMainInvokeEvent,
    request: IStartAiStreamRequest
  ): Promise<IStartAiStreamResponce> {
    console.log('startAiStream');
    console.log('messages', request.messages);
    const chatServiceImpl = ChatServiceFactory.createChatService(ChatServiceType.DEEPSEEK);
    const chatAI = chatServiceImpl.createChatAI();
    // 流式调用
    const stream = await chatAI.stream(
      { messages: [{ role: "user", content: request.messages }] },
      { configurable: { thread_id: "1" } }
    );
    console.log('stream', stream);
    for await (const part of stream) {
      console.log('part', part);
      event.sender.send(AI_STREAM, { id: request.id, data: part });
    }
    return { result: 'success' };
  }

  @IPC(CREATE_CHAT_SESSION)
  async createChatSession(
    event: Electron.IpcMainInvokeEvent,
  ): Promise<ICreateChatSessionResponce> {
    return { id: Date.now() + '' };
  }


  @IPC(AI_RENAME)
  async aiRename(): Promise<IStartAiRenameResponce> {
    console.log('aiRename');
    // 打开文件选择器，选择文件
    // 目前只支持 pdf 文件
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    if (canceled) {
      return { result: 'canceled' };
    }
    // 调用 deepseek 去重命名文件
    await renameFileTool(filePaths[0]);
    return { result: 'success' };
  }
}
