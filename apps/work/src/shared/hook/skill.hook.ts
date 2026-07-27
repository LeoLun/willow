import type { GetSkillListRequest, GetSkillListResponse } from "../api";

export interface ISkillApi {
  getSkillList(request: GetSkillListRequest): Promise<GetSkillListResponse>;
}
