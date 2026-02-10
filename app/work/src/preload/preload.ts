import { contextBridge, ipcRenderer } from "electron";
import type {
  IEchoResponce,
  IRenderHook,
  IStartOpencodeResponce,
} from "../shared";

import { ECHO, START_OPENCODE } from "../shared";

const ipcObject: IRenderHook = {
  async echo(message: string): Promise<IEchoResponce> {
    return await ipcRenderer.invoke(ECHO, message);
  },
  async startOpencode(): Promise<IStartOpencodeResponce> {
    return await ipcRenderer.invoke(START_OPENCODE);
  },
};

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
