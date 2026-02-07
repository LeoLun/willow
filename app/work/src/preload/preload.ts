import { contextBridge, ipcRenderer } from "electron";
import type {
  IEchoResponce,
  IRenderHook,
} from "../shared";

import {
  ECHO
} from "../shared";


const  ipcObject: IRenderHook  = {
  async echo(message: string): Promise<IEchoResponce> {
    return await ipcRenderer.invoke(ECHO, message);
  },
}

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
