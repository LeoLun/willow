import type { IConfigApi } from "./config.hook";
import type { IEventApi } from "./event.hook";
import type { ISessionApi } from "./session.hook";
import type { IWorkspaceApi } from "./workspace.hook";
export interface IRenderHook extends IWorkspaceApi, ISessionApi, IEventApi, IConfigApi {}

export * from "./dialog.hook";
