import type {
  GetAvailableSkillsRequest,
  GetAvailableSkillsResponse,
  GetWorkspaceAgentsRequest,
  GetWorkspaceAgentsResponse,
} from "../api";

export interface ISkillApi {
  getAvailableSkills(request: GetAvailableSkillsRequest): Promise<GetAvailableSkillsResponse>;
  getWorkspaceAgents(request?: GetWorkspaceAgentsRequest): Promise<GetWorkspaceAgentsResponse>;
}
