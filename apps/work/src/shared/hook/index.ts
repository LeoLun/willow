import type { IEventApi } from "./event.hook";
import type { ISettingApi } from "./setting.hook";

export interface IRenderHook extends IEventApi, ISettingApi {}
