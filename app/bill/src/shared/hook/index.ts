import { IOpenSettingWindowRenderer } from './open-setting-window';
import { ISetTemeRenderer } from './set-theme';

export interface IRenderHook extends IOpenSettingWindowRenderer, ISetTemeRenderer {}

export * from './open-setting-window';
export * from './set-theme';