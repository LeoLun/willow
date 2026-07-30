import { SkillService } from "@main/service/skill.service";
import { WorkspaceNotFoundError } from "@main/service/workspace.service";
import type { ApiResponse, GetSkillListRequest, GetSkillListResponse } from "@shared/api";
import { GET_SKILL_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";
import { checkWorkspaceId } from "../workspace/workspace-controller.params";

@Injectable()
export class GetSkillListController extends IPCBaseController<
  GetSkillListRequest,
  GetSkillListResponse
> {
  constructor(private readonly skillService: SkillService) {
    super();
  }

  @IPC(GET_SKILL_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetSkillListRequest,
  ): Promise<ApiResponse<GetSkillListResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      return this.buildResponse({
        skills: await this.skillService.getSkillList(request.workspaceId),
      });
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        return this.buildError(404, "Workspace not found");
      }
      throw error;
    }
  }

  checkParams(request: GetSkillListRequest): Error | undefined {
    return checkWorkspaceId(request);
  }
}
