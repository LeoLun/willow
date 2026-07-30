import { join } from "node:path";
import { loadSkills } from "@earendil-works/pi-agent-core";
import { NodeExecutionEnv } from "@earendil-works/pi-agent-core/node";
import type { BuiltinSkillInfo } from "@shared/api";
import type { AgentCoreOptions } from "@willow/core";
import { Injectable } from "@willow/poetry";
import { getEffectiveAppPath } from "../update/hot-update-launcher";
import { BuiltinSkillSettingDao } from "./dao/builtin-skill-setting.dao.server";

export class BuiltinSkillNotFoundError extends Error {
  constructor(skillId: string) {
    super(`Built-in skill not found: ${skillId}`);
    this.name = "BuiltinSkillNotFoundError";
  }
}

@Injectable()
export class BuiltinSkillService {
  constructor(private readonly builtinSkillSettingDao: BuiltinSkillSettingDao) {}

  getCoreOptions(): NonNullable<AgentCoreOptions["builtinSkills"]> {
    return {
      directory: this.getSkillsDirectory(),
      disabledIds: this.builtinSkillSettingDao
        .findAll()
        .filter((setting) => !setting.enabled)
        .map((setting) => setting.skillId),
    };
  }

  async getBuiltinSkillList(): Promise<BuiltinSkillInfo[]> {
    const settings = new Map(
      this.builtinSkillSettingDao
        .findAll()
        .map((setting) => [setting.skillId, setting.enabled] as const),
    );
    const skills = await this.loadBuiltinSkills();
    return skills.map((skill) => ({
      id: skill.name,
      name: skill.name,
      description: skill.description,
      scope: "global",
      enabled: settings.get(skill.name) ?? true,
    }));
  }

  async setBuiltinSkillEnabled(skillId: string, enabled: boolean): Promise<BuiltinSkillInfo> {
    const skill = (await this.getBuiltinSkillList()).find((candidate) => candidate.id === skillId);
    if (!skill) throw new BuiltinSkillNotFoundError(skillId);

    this.builtinSkillSettingDao.upsert(skillId, enabled);
    return { ...skill, enabled };
  }

  private getSkillsDirectory(): string {
    return join(getEffectiveAppPath(), "resources", "skills");
  }

  private async loadBuiltinSkills() {
    const directory = this.getSkillsDirectory();
    const env = new NodeExecutionEnv({ cwd: directory });
    const { skills } = await loadSkills(env, directory);
    return skills;
  }
}
