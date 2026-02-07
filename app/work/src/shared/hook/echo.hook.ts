export type IEchoResponce = {
  message: string;
}

export interface IEcho {
  echo(event:  Electron.IpcMainInvokeEvent, message: string): Promise<IEchoResponce>;
}

export interface IEchoRenderer {
  echo(message: string): Promise<IEchoResponce>;
}