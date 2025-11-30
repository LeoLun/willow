import { IOpenSettingWindowRenderer } from './window.hook';
import { ISetTemeRenderer } from './set-theme';
import { IChatHookRenderer } from './chat.hook';

export interface IOtherApi {
  getFilePath: (file: File) => string;
}

export interface IRenderHook extends IOpenSettingWindowRenderer, ISetTemeRenderer, IChatHookRenderer, IOtherApi {}  

export * from './window.hook';
export * from './set-theme';
export * from './chat.hook';