import { BuiltinSkillService } from "@main/service/builtin-skill.service";
import type {
  ApiResponse,
  GetBuiltinSkillListRequest,
  GetBuiltinSkillListResponse,
} from "@shared/api";
import { GET_BUILTIN_SKILL_LIST } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class GetBuiltinSkillListController extends IPCBaseController<
  GetBuiltinSkillListRequest,
  GetBuiltinSkillListResponse
> {
  constructor(private readonly builtinSkillService: BuiltinSkillService) {
    super();
  }

  @IPC(GET_BUILTIN_SKILL_LIST)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    _request: GetBuiltinSkillListRequest,
  ): Promise<ApiResponse<GetBuiltinSkillListResponse>> {
    return this.buildResponse({
      skills: await this.builtinSkillService.getBuiltinSkillList(),
    });
  }

  checkParams(_request: GetBuiltinSkillListRequest): Error | undefined {
    return undefined;
  }
}
