import { contextBridge, ipcRenderer } from "electron";
import type {
  IEchoResponce,
  IRenderHook,
  IStartOpencodeResponce,
  IInitProgressPayload,
  IInitWorkspacePayload,
  IInitOpencodeServicePayload,
  ISelectDirectoryResult,
} from "../shared";

import {
  ECHO,
  START_OPENCODE,
  INIT,
  INIT_PROGRESS,
  INIT_WORKSPACE,
  INIT_OPENCODE_SERVICE,
  SELECT_DIRECTORY,
} from "../shared";

const ipcObject: IRenderHook = {
  async echo(message: string): Promise<IEchoResponce> {
    return await ipcRenderer.invoke(ECHO, message);
  },
  async startOpencode(): Promise<IStartOpencodeResponce> {
    return await ipcRenderer.invoke(START_OPENCODE);
  },
  async init(): Promise<void> {
    return await ipcRenderer.invoke(INIT);
  },
  onInitProgress(callback: (payload: IInitProgressPayload) => void) {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: IInitProgressPayload,
    ) => callback(payload);
    ipcRenderer.on(INIT_PROGRESS, handler);
    return () => {
      ipcRenderer.removeListener(INIT_PROGRESS, handler);
    };
  },
  onInitWorkspace(callback: (payload: IInitWorkspacePayload) => void) {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: IInitWorkspacePayload,
    ) => callback(payload);
    ipcRenderer.on(INIT_WORKSPACE, handler);
    return () => {
      ipcRenderer.removeListener(INIT_WORKSPACE, handler);
    };
  },
  onInitOpencodeService(
    callback: (payload: IInitOpencodeServicePayload) => void,
  ) {
    const handler = (
      _event: Electron.IpcRendererEvent,
      payload: IInitOpencodeServicePayload,
    ) => callback(payload);
    ipcRenderer.on(INIT_OPENCODE_SERVICE, handler);
    return () => {
      ipcRenderer.removeListener(INIT_OPENCODE_SERVICE, handler);
    };
  },
  async selectDirectory(
    defaultPath?: string,
  ): Promise<ISelectDirectoryResult> {
    return await ipcRenderer.invoke(SELECT_DIRECTORY, defaultPath);
  },
};

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
