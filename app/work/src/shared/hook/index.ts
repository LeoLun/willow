import type { IAutomationApi } from "./automation.hook";
import type { IConfigApi } from "./config.hook";
import type { IDialogRenderer } from "./dialog.hook";
import type { IEventApi } from "./event.hook";
import type { ISessionApi } from "./session.hook";
import type { ISkillApi } from "./skill.hook";
import type { IWorkspaceApi } from "./workspace.hook";
export interface IRenderHook
  extends
    IWorkspaceApi,
    ISessionApi,
    ISkillApi,
    IEventApi,
    IConfigApi,
    IAutomationApi,
    IDialogRenderer {}

export * from "./dialog.hook";
