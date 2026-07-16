import { Injectable } from "@willow/poetry";
import { eq } from "drizzle-orm";
import type { NewUserConfig, UserConfig } from "../../db/schema";
import { userConfigs } from "../../db/schema";
import { DbService } from "../db.service";

const USER_CONFIG_ID = 1;

export type SaveUserConfigInput = Omit<NewUserConfig, "id">;

@Injectable()
export class UserConfigDao {
  constructor(private readonly dbService: DbService) {}

  find(): UserConfig | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(userConfigs)
      .where(eq(userConfigs.id, USER_CONFIG_ID))
      .get();
  }

  upsert(input: SaveUserConfigInput): UserConfig {
    return this.dbService
      .getDb()
      .insert(userConfigs)
      .values({ id: USER_CONFIG_ID, ...input })
      .onConflictDoUpdate({
        target: userConfigs.id,
        set: input,
      })
      .returning()
      .get();
  }
}
