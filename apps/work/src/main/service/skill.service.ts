import { isAbsolute, relative, resolve, sep } from "node:path";
import type { SkillInfo } from "@shared/api";
import { AgentCore } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { AgentService } from "./agent.service";
import { BuiltinSkillService } from "./builtin-skill.service";
import { SessionManagerFactory } from "./session-manager.factory";
import { WorkspaceService } from "./workspace.service";

@Injectable()
export class SkillService {
  constructor(
    private readonly agentService: AgentService,
    private readonly sessionManagerFactory: SessionManagerFactory,
    private readonly workspaceService: WorkspaceService,
    private readonly builtinSkillService: BuiltinSkillService,
  ) {}

  async getSkillList(workspaceId: number): Promise<SkillInfo[]> {
    const workspace = this.workspaceService.getWorkspaceDetail(workspaceId);
    const builtinSkills = this.builtinSkillService.getCoreOptions();
    const core = new AgentCore({
      cwd: workspace.path,
      models: this.agentService.getModels(),
      sessionRepo: this.sessionManagerFactory.create(workspaceId),
      builtinSkills,
    });
    const skills = await core.getSkills();
    return skills.map(({ name, description, filePath }) => ({
      name,
      description,
      filePath,
      source: this.getSkillSource(filePath, workspace.path, builtinSkills.directory),
    }));
  }

  private getSkillSource(
    filePath: string,
    workspacePath: string,
    builtinSkillsPath: string,
  ): SkillInfo["source"] {
    if (this.isPathInside(filePath, builtinSkillsPath)) return "builtin";
    return this.isPathInside(filePath, workspacePath) ? "project" : "global";
  }

  private isPathInside(filePath: string, directory: string): boolean {
    const pathFromDirectory = relative(resolve(directory), resolve(filePath));
    return (
      pathFromDirectory === "" ||
      (!pathFromDirectory.startsWith(`..${sep}`) &&
        pathFromDirectory !== ".." &&
        !isAbsolute(pathFromDirectory))
    );
  }
}
