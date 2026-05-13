import { SkillService } from "@main/service/skill.service";
import type {
  ApiResponse,
  GetAvailableSkillsRequest,
  GetAvailableSkillsResponse,
} from "@shared/api";
import { GET_AVAILABLE_SKILLS } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetAvailableSkillsController extends IPCBaseController<
  GetAvailableSkillsRequest,
  GetAvailableSkillsResponse
> {
  constructor(private readonly skillService: SkillService) {
    super();
  }

  @IPC(GET_AVAILABLE_SKILLS)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: GetAvailableSkillsRequest,
  ): Promise<ApiResponse<GetAvailableSkillsResponse>> {
    const error = this.checkParams(request);
    if (error) {
      return this.buildError(400, error.message);
    }

    const data = this.skillService.getAvailableSkills(request.workspaceId);
    return this.buildResponse(data);
  }

  checkParams(request: GetAvailableSkillsRequest): Error | undefined {
    if (
      request.workspaceId !== undefined &&
      (!request.workspaceId || Number.isNaN(request.workspaceId))
    ) {
      return new Error("workspaceId must be a valid number");
    }
    return undefined;
  }
}
