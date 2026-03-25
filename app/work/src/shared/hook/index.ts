import type { IEventApi } from "./event.hook";
import type { ISessionApi } from "./session.hook";
import type { IWorkspaceApi } from "./workspace.hook";
export interface IRenderHook extends IWorkspaceApi, ISessionApi, IEventApi {}

export * from "./dialog.hook";
