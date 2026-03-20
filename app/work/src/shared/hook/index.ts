import type { IWorkspaceApi } from "./workspace.hook";
export interface IRenderHook extends IWorkspaceApi {}

export * from "./echo.hook";
export * from "./init.hook";
export * from "./dialog.hook";
