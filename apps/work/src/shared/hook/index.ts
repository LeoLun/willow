import type { IAppUpdateApi } from "./app-update.hook";
import type { IAutomationApi } from "./automation.hook";
import type { IBoardApi } from "./board.hook";
import type { IEventApi } from "./event.hook";
import type { IFileSearchApi } from "./file-search.hook";
import type { IGitReviewApi } from "./git-review.hook";
import type { ILocalFileApi } from "./local-file.hook";
import type { IMessageApi } from "./message.hook";
import type { IPlanApi } from "./plan.hook";
import type { ISessionApi } from "./session.hook";
import type { ISettingApi } from "./setting.hook";
import type { ISkillApi } from "./skill.hook";
import type { IWorkspaceApi } from "./workspace.hook";

export interface IRenderHook
  extends
    IAppUpdateApi,
    IAutomationApi,
    IBoardApi,
    IEventApi,
    IFileSearchApi,
    IGitReviewApi,
    ILocalFileApi,
    IMessageApi,
    IPlanApi,
    ISessionApi,
    ISettingApi,
    ISkillApi,
    IWorkspaceApi {}
