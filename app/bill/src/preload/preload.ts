import { contextBridge, ipcRenderer } from "electron";
import type {
  IRenderHook,
  IOpenSettingWindowRequest,
  IOpenSettingWindowResponce,
  ISetTemeRequest,
  ISetTemeResponce
} from "../shared";

import {
  OPEN_SETTING_WINDOW,
  SET_THEME,
} from "../shared";


const  ipcObject: IRenderHook  = {
  async openSettingWindow(request: IOpenSettingWindowRequest): Promise<IOpenSettingWindowResponce> {
    return await ipcRenderer.invoke(OPEN_SETTING_WINDOW, request);
  },
  async setTeme(request: ISetTemeRequest): Promise<ISetTemeResponce> {
    return await ipcRenderer.invoke(SET_THEME, request);
  }
}

contextBridge.exposeInMainWorld("electronAPI", ipcObject);
