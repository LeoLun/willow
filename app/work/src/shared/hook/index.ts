import type { IWorkspaceApi } from "./workspace.hook";
import type { ISessionApi } from "./session.hook";
export interface IRenderHook extends IWorkspaceApi, ISessionApi {}

export * from "./echo.hook";
export * from "./init.hook";
export * from "./dialog.hook";
