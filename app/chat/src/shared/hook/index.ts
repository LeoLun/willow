import { IOpenSettingWindowRenderer } from './window.hook';
import { ISetTemeRenderer } from './set-theme';
import { IChatHookRenderer } from './chat.hook';

export interface IRenderHook extends IOpenSettingWindowRenderer, ISetTemeRenderer, IChatHookRenderer {}

export * from './window.hook';
export * from './set-theme';
export * from './chat.hook';