import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const workspaces = sqliteTable("workspaces", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  path: text("path").notNull(),
  kind: text("kind", { enum: ["project", "conversation"] })
    .notNull()
    .default("project"),
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

export const sessionContextSummaries = sqliteTable("session_context_summaries", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .references(() => sessions.id, { onDelete: "cascade" })
    .notNull(),
  modelId: text("model_id").notNull(),
  summary: text("summary").notNull(),
  indexText: text("index_text").notNull(),
  compressedUntilMessageId: integer("compressed_until_message_id").notNull(),
  sourceMessageCount: integer("source_message_count").notNull(),
  estimatedTokens: integer("estimated_tokens").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const conversationContextStates = sqliteTable("conversation_context_states", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  sessionId: integer("session_id")
    .references(() => sessions.id, { onDelete: "cascade" })
    .notNull(),
  modelId: text("model_id").notNull(),
  summary: text("summary").notNull(),
  stableFacts: text("stable_facts").notNull(),
  openLoops: text("open_loops").notNull(),
  checkpointIndex: integer("checkpoint_index").notNull().default(0),
  compressedUntilMessageId: integer("compressed_until_message_id").notNull(),
  sourceMessageCount: integer("source_message_count").notNull(),
  estimatedTokens: integer("estimated_tokens").notNull(),
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

export const automations = sqliteTable("automations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  workspaceId: integer("workspace_id")
    .references(() => workspaces.id, { onDelete: "cascade" })
    .notNull(),
  modelId: text("model_id"),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  status: text("status").notNull().default("enabled"),
  triggerType: text("trigger_type").notNull().default("schedule"),
  lastScheduledAt: integer("last_scheduled_at", { mode: "timestamp" }),
  lastRunAt: integer("last_run_at", { mode: "timestamp" }),
  lastCompletedAt: integer("last_completed_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const automationTriggers = sqliteTable("automation_triggers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  automationId: integer("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  type: text("type").notNull().default("schedule"),
  cronExpression: text("cron_expression").notNull(),
  timezone: text("timezone").notNull().default("Asia/Shanghai"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});

export const automationRuns = sqliteTable("automation_runs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  automationId: integer("automation_id")
    .references(() => automations.id, { onDelete: "cascade" })
    .notNull(),
  scheduledFor: integer("scheduled_for", { mode: "timestamp" }).notNull(),
  triggeredAt: integer("triggered_at", { mode: "timestamp" }).notNull(),
  runKind: text("run_kind").notNull(),
  status: text("status").notNull(),
  sessionId: integer("session_id").references(() => sessions.id, { onDelete: "set null" }),
  errorMessage: text("error_message"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .$defaultFn(() => new Date())
    .$onUpdateFn(() => new Date())
    .notNull(),
});
