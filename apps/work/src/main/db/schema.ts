import type { SessionTreeEntry } from "@earendil-works/pi-agent-core";
import { sql } from "drizzle-orm";
import { blob, index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path").notNull().unique(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`)
    .$onUpdate(() => new Date()),
});

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
