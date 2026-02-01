import { THEME_LIGHT, THEME_DARK } from "../constants";


export type THEME_TYPE = typeof THEME_LIGHT | typeof THEME_DARK;
export type ISetTemeRequest = {
  theme: THEME_TYPE;
}

export type ISetTemeResponce = {
  result: string;
}

export interface ISetTeme {
  setTeme(event:  Electron.IpcMainInvokeEvent, request: ISetTemeRequest): Promise<ISetTemeResponce>;
}

export interface ISetTemeRenderer {
  setTeme(request: ISetTemeRequest): Promise<ISetTemeResponce>;
}
