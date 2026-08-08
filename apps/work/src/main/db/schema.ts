import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import type {
  AutomationRunKind,
  AutomationRunStatus,
  AutomationStatus,
  AutomationTriggerType,
} from "@shared/api";
import { sql } from "drizzle-orm";
import {
  blob,
  index,
  integer,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable(
  "workspaces",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    path: text("path").notNull().unique(),
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("workspaces_pinned_updated_at_idx").on(table.pinned, table.updatedAt)],
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    agentSessionId: text("agent_session_id").notNull().unique(),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("sessions_workspace_updated_at_idx").on(table.workspaceId, table.updatedAt)],
);

export const sessionEntries = sqliteTable(
  "session_entries",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    sessionId: integer("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    entryId: text("entry_id").notNull(),
    entryType: text("entry_type").$type<SessionTreeEntry["type"]>().notNull(),
    payload: text("payload", { mode: "json" }).$type<SessionTreeEntry>().notNull(),
  },
  (table) => [
    uniqueIndex("session_entries_session_entry_unique").on(table.sessionId, table.entryId),
    index("session_entries_session_order_idx").on(table.sessionId, table.id),
    index("session_entries_session_type_order_idx").on(table.sessionId, table.entryType, table.id),
  ],
);

export const credentials = sqliteTable("credentials", {
  providerId: text("provider_id").primaryKey(),
  encryptedData: blob("encrypted_data", { mode: "buffer" }).notNull(),
});

export const userConfigs = sqliteTable("user_configs", {
  id: integer("id").primaryKey(),
  largeModelProviderId: text("large_model_provider_id"),
  largeModelId: text("large_model_id"),
  smallModelProviderId: text("small_model_provider_id"),
  smallModelId: text("small_model_id"),
});

export const builtinSkillSettings = sqliteTable("builtin_skill_settings", {
  skillId: text("skill_id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
});

export type StatisticsRunSource = "approval" | "chat" | "title";

export const statisticsRuns = sqliteTable(
  "statistics_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    source: text("source").$type<StatisticsRunSource>().notNull(),
    workspaceId: integer("workspace_id"),
    sessionId: text("session_id"),
    startedAt: integer("started_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("statistics_runs_source_started_at_idx").on(table.source, table.startedAt),
    index("statistics_runs_started_at_idx").on(table.startedAt),
  ],
);

export const statisticsUsage = sqliteTable(
  "statistics_usage",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    runId: integer("run_id")
      .notNull()
      .references(() => statisticsRuns.id, { onDelete: "cascade" }),
    providerId: text("provider_id").notNull(),
    providerName: text("provider_name").notNull(),
    modelId: text("model_id").notNull(),
    modelName: text("model_name").notNull(),
    inputTokens: integer("input_tokens").notNull(),
    outputTokens: integer("output_tokens").notNull(),
    cacheReadTokens: integer("cache_read_tokens").notNull(),
    cacheWriteTokens: integer("cache_write_tokens").notNull(),
    totalTokens: integer("total_tokens").notNull(),
    inputCost: real("input_cost").notNull(),
    outputCost: real("output_cost").notNull(),
    cacheReadCost: real("cache_read_cost").notNull(),
    cacheWriteCost: real("cache_write_cost").notNull(),
    totalCost: real("total_cost").notNull(),
    occurredAt: integer("occurred_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
  },
  (table) => [
    index("statistics_usage_occurred_at_idx").on(table.occurredAt),
    index("statistics_usage_model_occurred_at_idx").on(
      table.providerId,
      table.modelId,
      table.occurredAt,
    ),
    index("statistics_usage_run_id_idx").on(table.runId),
  ],
);

export type Workspace = typeof workspaces.$inferSelect;
export type NewWorkspace = typeof workspaces.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type SessionEntry = typeof sessionEntries.$inferSelect;
export type NewSessionEntry = typeof sessionEntries.$inferInsert;
export type StoredCredential = typeof credentials.$inferSelect;
export type NewStoredCredential = typeof credentials.$inferInsert;
export type UserConfig = typeof userConfigs.$inferSelect;
export type NewUserConfig = typeof userConfigs.$inferInsert;
export type BuiltinSkillSetting = typeof builtinSkillSettings.$inferSelect;
export type NewBuiltinSkillSetting = typeof builtinSkillSettings.$inferInsert;
export const automations = sqliteTable(
  "automations",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    workspaceId: integer("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status").$type<AutomationStatus>().notNull().default("enabled"),
    modelProviderId: text("model_provider_id"),
    modelId: text("model_id"),
    lastScheduledAt: integer("last_scheduled_at", { mode: "timestamp" }),
    lastRunAt: integer("last_run_at", { mode: "timestamp" }),
    lastCompletedAt: integer("last_completed_at", { mode: "timestamp" }),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [index("automations_workspace_updated_at_idx").on(table.workspaceId, table.updatedAt)],
);

export const automationTriggers = sqliteTable(
  "automation_triggers",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    automationId: integer("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    type: text("type").$type<AutomationTriggerType>().notNull().default("schedule"),
    cronExpression: text("cron_expression").notNull(),
    timezone: text("timezone").notNull(),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("automation_triggers_automation_id_unique").on(table.automationId)],
);

export const automationRuns = sqliteTable(
  "automation_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    automationId: integer("automation_id")
      .notNull()
      .references(() => automations.id, { onDelete: "cascade" }),
    sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
    runKind: text("run_kind").$type<AutomationRunKind>().notNull(),
    status: text("status").$type<AutomationRunStatus>().notNull(),
    scheduledFor: integer("scheduled_for", { mode: "timestamp" }),
    triggeredAt: integer("triggered_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    finishedAt: integer("finished_at", { mode: "timestamp" }),
    errorMessage: text("error_message"),
    createdAt: integer("created_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`),
    updatedAt: integer("updated_at", { mode: "timestamp" })
      .notNull()
      .default(sql`(unixepoch())`)
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("automation_runs_automation_triggered_idx").on(
      table.automationId,
      table.triggeredAt,
      table.id,
    ),
  ],
);

export type Automation = typeof automations.$inferSelect;
export type NewAutomation = typeof automations.$inferInsert;
export type AutomationTrigger = typeof automationTriggers.$inferSelect;
export type NewAutomationTrigger = typeof automationTriggers.$inferInsert;
export type AutomationRun = typeof automationRuns.$inferSelect;
export type NewAutomationRun = typeof automationRuns.$inferInsert;
export type StatisticsRun = typeof statisticsRuns.$inferSelect;
export type NewStatisticsRun = typeof statisticsRuns.$inferInsert;
export type StatisticsUsage = typeof statisticsUsage.$inferSelect;
export type NewStatisticsUsage = typeof statisticsUsage.$inferInsert;
