import type {
  GetBuiltinSkillListRequest,
  GetBuiltinSkillListResponse,
  GetSkillListRequest,
  GetSkillListResponse,
  SetBuiltinSkillEnabledRequest,
  SetBuiltinSkillEnabledResponse,
} from "../api";

export interface ISkillApi {
  getSkillList(request: GetSkillListRequest): Promise<GetSkillListResponse>;
  getBuiltinSkillList(request?: GetBuiltinSkillListRequest): Promise<GetBuiltinSkillListResponse>;
  setBuiltinSkillEnabled(
    request: SetBuiltinSkillEnabledRequest,
  ): Promise<SetBuiltinSkillEnabledResponse>;
}
