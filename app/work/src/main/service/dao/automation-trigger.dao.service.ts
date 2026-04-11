import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { and, eq, inArray } from "drizzle-orm";
import { automationTriggers } from "../../db/schema";

type AutomationTriggerInsert = typeof automationTriggers.$inferInsert;

@Injectable()
export class AutomationTriggerDao {
  constructor(private readonly dbService: DbService) {}

  findById(id: number) {
    return this.dbService
      .getDb()
      .select()
      .from(automationTriggers)
      .where(eq(automationTriggers.id, id))
      .get();
  }

  findByAutomationId(automationId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(automationTriggers)
      .where(eq(automationTriggers.automationId, automationId))
      .get();
  }

  findByAutomationIds(automationIds: number[]) {
    if (automationIds.length === 0) {
      return [];
    }
    return this.dbService
      .getDb()
      .select()
      .from(automationTriggers)
      .where(inArray(automationTriggers.automationId, automationIds))
      .all();
  }

  findActiveScheduleByAutomationId(automationId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(automationTriggers)
      .where(
        and(
          eq(automationTriggers.automationId, automationId),
          eq(automationTriggers.type, "schedule"),
          eq(automationTriggers.isActive, true),
        ),
      )
      .get();
  }

  insert(data: Omit<AutomationTriggerInsert, "id">) {
    return this.dbService.getDb().insert(automationTriggers).values(data).returning().get();
  }

  update(id: number, data: Partial<Omit<AutomationTriggerInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(automationTriggers)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationTriggers.id, id))
      .returning()
      .get();
  }

  deleteByAutomationId(automationId: number) {
    return this.dbService
      .getDb()
      .delete(automationTriggers)
      .where(eq(automationTriggers.automationId, automationId))
      .returning()
      .all();
  }
}
