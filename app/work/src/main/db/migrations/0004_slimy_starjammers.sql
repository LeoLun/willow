CREATE TABLE `automation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`automation_id` integer NOT NULL,
	`scheduled_for` integer NOT NULL,
	`triggered_at` integer NOT NULL,
	`run_kind` text NOT NULL,
	`status` text NOT NULL,
	`session_id` integer,
	`error_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `automation_triggers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`automation_id` integer NOT NULL,
	`type` text DEFAULT 'schedule' NOT NULL,
	`cron_expression` text NOT NULL,
	`timezone` text DEFAULT 'Asia/Shanghai' NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `automations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text DEFAULT 'enabled' NOT NULL,
	`trigger_type` text DEFAULT 'schedule' NOT NULL,
	`last_scheduled_at` integer,
	`last_run_at` integer,
	`last_completed_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_session_messages` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`group_id` integer NOT NULL,
	`session_id` integer NOT NULL,
	`content` text NOT NULL,
	`role` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_session_messages`("id", "group_id", "session_id", "content", "role", "created_at", "updated_at") SELECT "id", "group_id", "session_id", "content", "role", "created_at", "updated_at" FROM `session_messages`;--> statement-breakpoint
DROP TABLE `session_messages`;--> statement-breakpoint
ALTER TABLE `__new_session_messages` RENAME TO `session_messages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text NOT NULL,
	`created_at` integer NOT NULL,
	`last_active_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_sessions`("id", "workspace_id", "title", "created_at", "last_active_at", "updated_at") SELECT "id", "workspace_id", "title", "created_at", "last_active_at", "updated_at" FROM `sessions`;--> statement-breakpoint
DROP TABLE `sessions`;--> statement-breakpoint
ALTER TABLE `__new_sessions` RENAME TO `sessions`;--> statement-breakpoint
CREATE TABLE `__new_workspaces` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`path` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_workspaces`("id", "name", "path", "created_at", "updated_at") SELECT "id", "name", "path", "created_at", "updated_at" FROM `workspaces`;--> statement-breakpoint
DROP TABLE `workspaces`;--> statement-breakpoint
ALTER TABLE `__new_workspaces` RENAME TO `workspaces`;