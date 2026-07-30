import { Injectable } from "@willow/poetry";
import type { BuiltinSkillSetting } from "../../db/schema";
import { builtinSkillSettings } from "../../db/schema";
import { DbService } from "../db.service";

@Injectable()
export class BuiltinSkillSettingDao {
  constructor(private readonly dbService: DbService) {}

  findAll(): BuiltinSkillSetting[] {
    return this.dbService.getDb().select().from(builtinSkillSettings).all();
  }

  upsert(skillId: string, enabled: boolean): BuiltinSkillSetting {
    return this.dbService
      .getDb()
      .insert(builtinSkillSettings)
      .values({ skillId, enabled })
      .onConflictDoUpdate({
        target: builtinSkillSettings.skillId,
        set: { enabled },
      })
      .returning()
      .get();
  }
}
