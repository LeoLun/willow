import type { IEventApi } from "./event.hook";
import type { IFileSearchApi } from "./file-search.hook";
import type { ILocalFileApi } from "./local-file.hook";
import type { IMessageApi } from "./message.hook";
import type { ISessionApi } from "./session.hook";
import type { ISettingApi } from "./setting.hook";
import type { ISkillApi } from "./skill.hook";
import type { IWorkspaceApi } from "./workspace.hook";

export interface IRenderHook
  extends
    IAppUpdateApi,
    IEventApi,
    IFileSearchApi,
    ILocalFileApi,
    IMessageApi,
    ISessionApi,
    ISettingApi,
    ISkillApi,
    IWorkspaceApi {}
import type { IAppUpdateApi } from "./app-update.hook";
