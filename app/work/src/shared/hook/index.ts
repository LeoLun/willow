import type { IWorkspaceApi } from "./workspace.hook";
import type { ISessionApi } from "./session.hook";
import type { IEventApi } from "./event.hook";
export interface IRenderHook extends IWorkspaceApi, ISessionApi, IEventApi {}

export * from "./dialog.hook";
