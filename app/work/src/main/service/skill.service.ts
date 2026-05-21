import { existsSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { WorkspaceDao } from "@main/service/dao/workspace.dao.service";
import type { GetAvailableSkillsResponse, SkillScope, SkillSummary } from "@shared/api";
import { loadSkills } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { app } from "electron";

@Injectable()
export class SkillService {
  constructor(private readonly workspaceDao: WorkspaceDao) {}

  /**
   * Kept for compatibility with existing startup wiring. `/init` is now an
   * in-app built-in command, not a user skill written to disk.
   * We also remove the legacy user init skill directory here to clean up.
   */
  ensureBuiltinSkills() {
    const userDir = join(app.getPath("userData"), ".agents", "skills");
    const legacyInitDir = join(userDir, "init");
    try {
      if (existsSync(legacyInitDir)) {
        rmSync(legacyInitDir, { recursive: true, force: true });
        console.log(`[SkillService] Removed legacy init skill directory: ${legacyInitDir}`);
      }
    } catch (error) {
      console.error(
        `[SkillService] Failed to remove legacy init skill directory: ${legacyInitDir}`,
        error,
      );
    }
  }

  getAvailableSkills(workspaceId?: number): GetAvailableSkillsResponse {
    const workspace = workspaceId ? this.workspaceDao.findById(workspaceId) : undefined;
    const cwd = workspace?.path ?? this.getEmptyWorkspaceCwd();
    const builtinDir = this.getBuiltinSkillsDir();
    const { skills, userDir, projectDir } = loadSkills({
      cwd,
      userData: app.getPath("userData"),
      builtinDir,
    });

    const summaries = skills
      .map((skill) => {
        if (this.isLegacyBuiltinInitSkill(skill.filePath, userDir)) {
          return null;
        }
        const scope = this.resolveScope(skill.filePath, userDir, projectDir, builtinDir);
        if (!scope) {
          return null;
        }
        if (!workspace && scope === "workspace") {
          return null;
        }
        const isBuiltin = this.isWithin(skill.filePath, builtinDir);
        return {
          name: skill.name,
          description: skill.description,
          filePath: skill.filePath,
          scope,
          scopeLabel: isBuiltin ? "内置" : scope === "global" ? "全局" : "工作空间",
        } satisfies SkillSummary;
      })
      .filter((skill): skill is SkillSummary => skill !== null);

    return { skills: summaries };
  }

  private getEmptyWorkspaceCwd() {
    return app.getPath("userData");
  }

  private getBuiltinSkillsDir(): string {
    return app.isPackaged
      ? join(process.resourcesPath, "builtin-skills")
      : join(app.getAppPath(), "builtin-skills");
  }

  private resolveScope(
    filePath: string,
    userDir: string,
    projectDir: string,
    builtinDir?: string,
  ): SkillScope | undefined {
    if (this.isWithin(filePath, projectDir)) {
      return "workspace";
    }
    if (this.isWithin(filePath, userDir)) {
      return "global";
    }
    if (builtinDir && this.isWithin(filePath, builtinDir)) {
      return "global";
    }
    return undefined;
  }

  private isWithin(targetPath: string, basePath: string) {
    const rel = relative(basePath, targetPath);
    return rel !== "" && !rel.startsWith("..") && !rel.startsWith("../");
  }

  private isLegacyBuiltinInitSkill(filePath: string, userDir: string) {
    return filePath === join(userDir, "init", "SKILL.md");
  }
}
