import type { IEventApi } from "./event.hook";
import type { IMessageApi } from "./message.hook";
import type { ISettingApi } from "./setting.hook";
import type { IWorkspaceApi } from "./workspace.hook";

export interface IRenderHook extends IEventApi, IMessageApi, ISettingApi, IWorkspaceApi {}
