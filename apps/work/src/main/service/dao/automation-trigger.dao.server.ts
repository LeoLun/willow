import { Injectable } from "@willow/poetry";
import { eq } from "drizzle-orm";
import type { AutomationTrigger, NewAutomationTrigger } from "../../db/schema";
import { automationTriggers } from "../../db/schema";
import { DbService } from "../db.service";

export type UpdateTriggerInput = Partial<
  Pick<NewAutomationTrigger, "type" | "cronExpression" | "timezone" | "isActive">
>;

@Injectable()
export class AutomationTriggerDao {
  constructor(private readonly dbService: DbService) {}

  findByAutomationId(automationId: number): AutomationTrigger | undefined {
    return this.dbService
      .getDb()
      .select()
      .from(automationTriggers)
      .where(eq(automationTriggers.automationId, automationId))
      .get();
  }

  update(automationId: number, input: UpdateTriggerInput): AutomationTrigger | undefined {
    const existing = this.findByAutomationId(automationId);
    if (!existing || Object.keys(input).length === 0) {
      return existing;
    }
    return this.dbService
      .getDb()
      .update(automationTriggers)
      .set(input)
      .where(eq(automationTriggers.automationId, automationId))
      .returning()
      .get();
  }
}
