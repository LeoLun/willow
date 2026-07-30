import {
  BuiltinSkillNotFoundError,
  BuiltinSkillService,
} from "@main/service/builtin-skill.service";
import type {
  ApiResponse,
  SetBuiltinSkillEnabledRequest,
  SetBuiltinSkillEnabledResponse,
} from "@shared/api";
import { SET_BUILTIN_SKILL_ENABLED } from "@shared/constants";
import { Injectable, IPC } from "@willow/poetry";
import { IPCBaseController } from "../ipc.base.controller";

@Injectable()
export class SetBuiltinSkillEnabledController extends IPCBaseController<
  SetBuiltinSkillEnabledRequest,
  SetBuiltinSkillEnabledResponse
> {
  constructor(private readonly builtinSkillService: BuiltinSkillService) {
    super();
  }

  @IPC(SET_BUILTIN_SKILL_ENABLED)
  async run(
    _event: Electron.IpcMainInvokeEvent,
    request: SetBuiltinSkillEnabledRequest,
  ): Promise<ApiResponse<SetBuiltinSkillEnabledResponse>> {
    const error = this.checkParams(request);
    if (error) return this.buildError(400, error.message);

    try {
      return this.buildResponse({
        skill: await this.builtinSkillService.setBuiltinSkillEnabled(request.id, request.enabled),
      });
    } catch (error) {
      if (error instanceof BuiltinSkillNotFoundError) {
        return this.buildError(404, "Built-in skill not found");
      }
      throw error;
    }
  }

  checkParams(request: SetBuiltinSkillEnabledRequest): Error | undefined {
    if (!request || typeof request !== "object") {
      return new Error("request must be an object");
    }
    if (
      typeof request.id !== "string" ||
      request.id.trim() === "" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.id)
    ) {
      return new Error("id must be a valid skill id");
    }
    if (typeof request.enabled !== "boolean") {
      return new Error("enabled must be a boolean");
    }
    return undefined;
  }
}
