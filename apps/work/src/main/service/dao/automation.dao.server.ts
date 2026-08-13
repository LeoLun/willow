import { Injectable } from "@willow/poetry";
import { desc, eq } from "drizzle-orm";
import type {
  Automation,
  AutomationTrigger,
  NewAutomation,
  NewAutomationTrigger,
} from "../../db/schema";
import { automations, automationTriggers } from "../../db/schema";
import { DbService } from "../db.service";

export type CreateAutomationInput = Pick<
  NewAutomation,
  "workspaceId" | "title" | "prompt" | "status" | "modelProviderId" | "modelId"
>;

export type UpdateAutomationInput = Partial<{
  workspaceId: number;
  title: string;
  prompt: string;
  status: Automation["status"];
  modelProviderId: string | null;
  modelId: string | null;
  lastScheduledAt: Date;
  lastRunAt: Date;
  lastCompletedAt: Date;
}>;

export type CreateAutomationWithTriggerInput = {
  automation: CreateAutomationInput;
  trigger: Pick<NewAutomationTrigger, "type" | "cronExpression" | "timezone" | "isActive">;
};

export type AutomationWithTrigger = Automation & { trigger: AutomationTrigger };

@Injectable()
export class AutomationDao {
  constructor(private readonly dbService: DbService) {}

  findAll(): Automation[] {
    return this.dbService
      .getDb()
      .select()
      .from(automations)
      .orderBy(desc(automations.updatedAt))
      .all();
  }

  findById(id: number): Automation | undefined {
    return this.dbService.getDb().select().from(automations).where(eq(automations.id, id)).get();
  }

  findEnabledWithActiveTriggers(): AutomationWithTrigger[] {
    const rows = this.dbService
      .getDb()
      .select({
        automation: automations,
        trigger: automationTriggers,
      })
      .from(automations)
      .innerJoin(automationTriggers, eq(automationTriggers.automationId, automations.id))
      .where(eq(automations.status, "enabled"))
      .all();
    return rows
      .filter(({ trigger }) => trigger.isActive)
      .map(({ automation, trigger }) => ({ ...automation, trigger }));
  }

  findWithTriggerById(id: number): AutomationWithTrigger | undefined {
    const row = this.dbService
      .getDb()
      .select({
        automation: automations,
        trigger: automationTriggers,
      })
      .from(automations)
      .innerJoin(automationTriggers, eq(automationTriggers.automationId, automations.id))
      .where(eq(automations.id, id))
      .get();
    if (!row) return undefined;
    return { ...row.automation, trigger: row.trigger };
  }

  findWithTriggersByWorkspaceId(workspaceId: number): AutomationWithTrigger[] {
    return this.dbService
      .getDb()
      .select({
        automation: automations,
        trigger: automationTriggers,
      })
      .from(automations)
      .innerJoin(automationTriggers, eq(automationTriggers.automationId, automations.id))
      .where(eq(automations.workspaceId, workspaceId))
      .orderBy(desc(automations.updatedAt))
      .all()
      .map(({ automation, trigger }) => ({ ...automation, trigger }));
  }

  createWithTrigger(input: CreateAutomationWithTriggerInput): AutomationWithTrigger {
    const { automation, trigger } = input;
    const result = this.dbService.getDb().transaction((transaction) => {
      const created = transaction.insert(automations).values(automation).returning().get();
      const createdTrigger = transaction
        .insert(automationTriggers)
        .values({ ...trigger, automationId: created.id })
        .returning()
        .get();
      return { automation: created, trigger: createdTrigger };
    });
    return { ...result.automation, trigger: result.trigger };
  }

  update(id: number, input: UpdateAutomationInput): Automation | undefined {
    if (Object.keys(input).length === 0) {
      return this.findById(id);
    }
    return this.dbService
      .getDb()
      .update(automations)
      .set(input)
      .where(eq(automations.id, id))
      .returning()
      .get();
  }

  delete(id: number): boolean {
    return (
      this.dbService.getDb().delete(automations).where(eq(automations.id, id)).run().changes > 0
    );
  }
}
