import type { IWorkspaceApi } from "./workspace.hook";
import type { ISessionApi } from "./session.hook";
export interface IRenderHook extends IWorkspaceApi, ISessionApi {}

export * from "./dialog.hook";
