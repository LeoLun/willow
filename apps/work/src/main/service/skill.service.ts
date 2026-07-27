import type { SkillInfo } from "@shared/api";
import { AgentCore } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { SessionManagerFactory } from "./session-manager.factory";
import { WorkspaceService } from "./workspace.service";

@Injectable()
export class SkillService {
  constructor(
    private readonly agentService: AgentService,
    private readonly sessionManagerFactory: SessionManagerFactory,
    private readonly workspaceService: WorkspaceService,
  ) {}

  async getSkillList(workspaceId: number): Promise<SkillInfo[]> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const core = new AgentCore({
      cwd: workspace.path,
      models: this.agentService.getModels(),
      sessionRepo: this.sessionManagerFactory.create(workspaceId),
    });
    const skills = await core.getSkills();
    return skills.map(({ name, description, filePath }) => ({
      name,
      description,
      filePath,
    }));
  }
}
