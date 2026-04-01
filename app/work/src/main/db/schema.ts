import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date())
    .notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id")
    .references(() => workspaces.id)
    .notNull(),
  title: text("title").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  lastActiveAt: integer("last_active_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const sessionMessages = sqliteTable("session_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  groupId: integer("group_id").notNull(),
  sessionId: integer("session_id")
    .references(() => sessions.id)
    .notNull(),
  // JSON 格式存储消息内容
  content: text("content").notNull(),
  role: text("role").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const tavilyApiKeys = sqliteTable("tavily_api_keys", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  apiKey: text("api_key").notNull(),
  monthlyLimit: integer("monthly_limit").notNull().default(1000),
  currentMonthUsage: integer("current_month_usage").notNull().default(0),
  usageResetMonth: text("usage_reset_month").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const models = sqliteTable("models", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  modelId: text("model_id").notNull(),
  name: text("name").notNull(),
  api: text("api").notNull(),
  provider: text("provider").notNull(),
  baseUrl: text("base_url").notNull(),
  apiKey: text("api_key"),
  reasoning: integer("reasoning", { mode: "boolean" }).notNull().default(false),
  contextWindow: integer("context_window").notNull().default(64000),
  maxTokens: integer("max_tokens").notNull().default(8192),
  isDefault: integer("is_default", { mode: "boolean" }).notNull().default(false),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
