export type IStartOpencodeResponce = {
  url: string;
};

export interface IStartOpencode {
  startOpencode(
    event: Electron.IpcMainInvokeEvent,
  ): Promise<IStartOpencodeResponce>;
}

export interface IStartOpencodeRenderer {
  startOpencode(): Promise<IStartOpencodeResponce>;
}
