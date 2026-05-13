import type { GetAvailableSkillsRequest, GetAvailableSkillsResponse } from "../api";

export interface ISkillApi {
  getAvailableSkills(request: GetAvailableSkillsRequest): Promise<GetAvailableSkillsResponse>;
}
