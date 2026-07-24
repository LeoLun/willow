import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
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

export type StatisticsRunSource = "chat" | "title";

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
export type StatisticsRun = typeof statisticsRuns.$inferSelect;
export type NewStatisticsRun = typeof statisticsRuns.$inferInsert;
export type StatisticsUsage = typeof statisticsUsage.$inferSelect;
export type NewStatisticsUsage = typeof statisticsUsage.$inferInsert;
