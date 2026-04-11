import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { and, eq } from "drizzle-orm";
import { automations } from "../../db/schema";

type AutomationInsert = typeof automations.$inferInsert;

@Injectable()
export class AutomationDao {
  constructor(private readonly dbService: DbService) {}

  findAll() {
    return this.dbService.getDb().select().from(automations).all();
  }

  findById(id: number) {
    return this.dbService.getDb().select().from(automations).where(eq(automations.id, id)).get();
  }

  findByWorkspaceId(workspaceId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(automations)
      .where(eq(automations.workspaceId, workspaceId))
      .all();
  }

  findEnabledScheduleAutomations() {
    return this.dbService
      .getDb()
      .select()
      .from(automations)
      .where(and(eq(automations.status, "enabled"), eq(automations.triggerType, "schedule")))
      .all();
  }

  insert(data: Omit<AutomationInsert, "id">) {
    return this.dbService.getDb().insert(automations).values(data).returning().get();
  }

  update(id: number, data: Partial<Omit<AutomationInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(automations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automations.id, id))
      .returning()
      .get();
  }

  deleteById(id: number) {
    return this.dbService
      .getDb()
      .delete(automations)
      .where(eq(automations.id, id))
      .returning()
      .get();
  }
}
