import { DbService } from "@main/service/db.service";
import { Injectable } from "@willow/poetry";
import { desc, eq, inArray } from "drizzle-orm";
import { automationRuns } from "../../db/schema";

type AutomationRunInsert = typeof automationRuns.$inferInsert;

@Injectable()
export class AutomationRunDao {
  constructor(private readonly dbService: DbService) {}

  findById(id: number) {
    return this.dbService
      .getDb()
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.id, id))
      .get();
  }

  findLatestByAutomationId(automationId: number) {
    return this.dbService
      .getDb()
      .select()
      .from(automationRuns)
      .where(eq(automationRuns.automationId, automationId))
      .orderBy(desc(automationRuns.scheduledFor), desc(automationRuns.id))
      .get();
  }

  findLatestByAutomationIds(automationIds: number[]) {
    if (automationIds.length === 0) {
      return [];
    }
    return this.dbService
      .getDb()
      .select()
      .from(automationRuns)
      .where(inArray(automationRuns.automationId, automationIds))
      .orderBy(desc(automationRuns.scheduledFor), desc(automationRuns.id))
      .all();
  }

  insert(data: Omit<AutomationRunInsert, "id">) {
    return this.dbService.getDb().insert(automationRuns).values(data).returning().get();
  }

  update(id: number, data: Partial<Omit<AutomationRunInsert, "id">>) {
    return this.dbService
      .getDb()
      .update(automationRuns)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(automationRuns.id, id))
      .returning()
      .get();
  }
}
