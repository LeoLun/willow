import { relative } from "node:path";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import type { GetAvailableSkillsResponse, SkillScope, SkillSummary } from "@shared/api";
import { loadSkills } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { app } from "electron";

@Injectable()
export class SkillService {
  constructor(private readonly workspaceDao: WorkspaceDao) {}

  getAvailableSkills(workspaceId?: number): GetAvailableSkillsResponse {
    const workspace = workspaceId ? this.workspaceDao.findById(workspaceId) : undefined;
    const cwd = workspace?.path ?? this.getEmptyWorkspaceCwd();
    const { skills, userDir, projectDir } = loadSkills({
      cwd,
      userData: app.getPath("userData"),
    });

    const summaries = skills
      .map((skill) => {
        const scope = this.resolveScope(skill.filePath, userDir, projectDir);
        if (!scope) {
          return null;
        }
        if (!workspace && scope === "workspace") {
          return null;
        }
        return {
          name: skill.name,
          description: skill.description,
          filePath: skill.filePath,
          scope,
          scopeLabel: scope === "global" ? "全局" : "工作空间",
        } satisfies SkillSummary;
      })
      .filter((skill): skill is SkillSummary => skill !== null);

    return { skills: summaries };
  }

  private getEmptyWorkspaceCwd() {
    return app.getPath("userData");
  }

  private resolveScope(
    filePath: string,
    userDir: string,
    projectDir: string,
  ): SkillScope | undefined {
    if (this.isWithin(filePath, projectDir)) {
      return "workspace";
    }
    if (this.isWithin(filePath, userDir)) {
      return "global";
    }
    return undefined;
  }

  private isWithin(targetPath: string, basePath: string) {
    const rel = relative(basePath, targetPath);
    return rel !== "" && !rel.startsWith("..") && !rel.startsWith("../");
  }
}
