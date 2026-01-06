import { On, WindowFactoryResolver, Module, IPC } from "poetry";
import { NotionService } from "./service/notion.service";
import { WeChatBillService } from "./service/wechat-bill.service";
import { AlipayBillService } from "./service/alipay-bill.service";
import { MainWindow } from "./window/main.window";
import { DialogWindow } from "./window/dialog.window";
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
  IStartImportToNotionResponce,
  IParseBillFileResponce,
  IAiClassifyBillResponce,
  IUploadBillToNotionResponce,
} from "../shared";

import {
  AI_RENAME,
  AI_STREAM,
  CREATE_CHAT_SESSION,
  OPEN_SETTING_WINDOW,
  START_AI_STREAM,
  AI_RENAME_APPLY,
  AI_RENAME_RECOMMEND,
  AI_IMPORT_TO_NOTION,
  PARSE_BILL_FILE,
  AI_CLASSIFY_BILL,
  UPLOAD_BILL_TO_NOTION,
} from "../shared";
import { BillService } from "./service/bill.service";
import { renameFileTool as aiRenameFileTool } from "./agent/rename.agent";
import { rename as fsRename, stat as fsStat } from "fs/promises";
import path from "path";

if (require("electron-squirrel-startup")) {
  app.quit();
}

@Module({
  imports: [],
  windows: [MainWindow, SettingWindow, DialogWindow],
  providers: [NotionService, BillService, WeChatBillService, AlipayBillService],
})
export class AppModule implements IOpenSettingWindow, IChatHookWindow {
  private windowFactoryResolver: WindowFactoryResolver;
  private mainWindow: MainWindow;
  private billService: BillService;

  constructor(windowFactoryResolver: WindowFactoryResolver, billService: BillService) {
    this.windowFactoryResolver = windowFactoryResolver;
    this.billService = billService;   
  }

  createWindow() {
    this.mainWindow = this.windowFactoryResolver.resolveWindowFactory(MainWindow);
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
    const settingWindow = this.windowFactoryResolver.resolveWindowFactory(SettingWindow);
    settingWindow.showModal(this.mainWindow.getWindow());
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
    _event: Electron.IpcMainInvokeEvent,
  ): Promise<ICreateChatSessionResponce> {
    void _event;
    return { id: Date.now() + '' };
  }


  @IPC(AI_RENAME)
  async aiRename(): Promise<IStartAiRenameResponce> {
    console.log('aiRename');
    // 打开文件选择器，选择文件
    // 目前只支持 pdf 文件
    const { canceled, filePaths: _filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'PDF Files', extensions: ['pdf'] }],
    });
    void _filePaths;
    if (canceled) {
      return { result: 'canceled' };
    }
    // 调用 deepseek 去重命名文件
    // await renameFileTool(filePaths[0]);
    // 打开一个弹窗
    const dialogWindow = this.windowFactoryResolver.resolveWindowFactory(DialogWindow);
    dialogWindow.show(this.mainWindow.getWindow(), 'rename');
    return { result: 'success' };
  }

  @IPC(AI_RENAME_RECOMMEND)
  async aiRenameRecommend(
    _event: Electron.IpcMainInvokeEvent,
    request: { filePath: string }
  ): Promise<{ result: 'success'; filePath: string; recommendations: string[] } | { result: 'error'; error: string }> {
    try {
      const filePath = request?.filePath;
      if (!filePath) return { result: 'error', error: '缺少 filePath' };
      const { recommendations } = await aiRenameFileTool(filePath);
      return { result: 'success', filePath, recommendations };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { result: 'error', error };
    }
  }

  @IPC(AI_RENAME_APPLY)
  async aiRenameApply(
    _event: Electron.IpcMainInvokeEvent,
    request: { filePath: string; newBaseName: string }
  ): Promise<{ result: 'success'; oldPath: string; newPath: string } | { result: 'error'; error: string }> {
    try {
      const filePath = request?.filePath;
      const newBaseName = (request?.newBaseName || '').trim();
      if (!filePath) return { result: 'error', error: '缺少 filePath' };
      if (!newBaseName) return { result: 'error', error: '缺少 newBaseName' };

      const parsed = path.parse(filePath);
      const dir = parsed.dir;
      const ext = parsed.ext || '';

      const sanitize = (name: string) =>
        name
          .replace(/[\\/:*?"<>|]/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

      const safeBase = sanitize(newBaseName);
      if (!safeBase) return { result: 'error', error: 'newBaseName 非法' };

      const candidatePath = (suffix?: number) =>
        path.join(dir, suffix ? `${safeBase}-${suffix}${ext}` : `${safeBase}${ext}`);

      let target = candidatePath();
      // 避免覆盖同名文件
      for (let i = 0; i < 200; i++) {
        try {
          await fsStat(target);
          target = candidatePath(i + 1);
        } catch {
          break;
        }
      }

      await fsRename(filePath, target);
      return { result: 'success', oldPath: filePath, newPath: target };
    } catch (e: unknown) {
      const error = e instanceof Error ? e.message : String(e);
      return { result: 'error', error };
    }
  }

  @IPC(AI_IMPORT_TO_NOTION)
  async importToNotion(event: Electron.IpcMainInvokeEvent, filePath?: string): Promise<IStartImportToNotionResponce> {
    this.billService.importToNotion(event, filePath);
    return { result: 'success' };
  }

  @IPC(PARSE_BILL_FILE)
  async parseBillFile(
    event: Electron.IpcMainInvokeEvent,
    filePath: string
  ): Promise<IParseBillFileResponce> {
    return await this.billService.parseBillList(event, filePath);
  }

  @IPC(AI_CLASSIFY_BILL)
  async aiClassifyBill(
    event: Electron.IpcMainInvokeEvent,
    jobId: string
  ): Promise<IAiClassifyBillResponce> {
    return await this.billService.aiClassifyBill(event, jobId);
  }

  @IPC(UPLOAD_BILL_TO_NOTION)
  async uploadBillToNotion(
    event: Electron.IpcMainInvokeEvent,
    jobId: string
  ): Promise<IUploadBillToNotionResponce> {
    return await this.billService.uploadBillToNotion(event, jobId);
  }
}
