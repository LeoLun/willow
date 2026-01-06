export type IOpenSettingWindowRequest = {
  result: string;
}

export type IOpenSettingWindowResponce = {
  result: string;
}

export interface IOpenSettingWindow {
  openSettingWindow(event:  Electron.IpcMainInvokeEvent, request: IOpenSettingWindowRequest): Promise<IOpenSettingWindowResponce>;
}

export interface IOpenSettingWindowRenderer {
  openSettingWindow(request: IOpenSettingWindowRequest): Promise<IOpenSettingWindowResponce>;
}
