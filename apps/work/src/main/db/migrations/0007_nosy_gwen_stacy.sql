CREATE TABLE `automation_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`automation_id` integer NOT NULL,
	`session_id` integer,
	`run_kind` text NOT NULL,
	`status` text NOT NULL,
	`scheduled_for` integer,
	`triggered_at` integer DEFAULT (unixepoch()) NOT NULL,
	`finished_at` integer,
	`error_message` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `automation_runs_automation_triggered_idx` ON `automation_runs` (`automation_id`,`triggered_at`,`id`);--> statement-breakpoint
CREATE TABLE `automation_triggers` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`automation_id` integer NOT NULL,
	`type` text DEFAULT 'schedule' NOT NULL,
	`cron_expression` text NOT NULL,
	`timezone` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`automation_id`) REFERENCES `automations`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `automation_triggers_automation_id_unique` ON `automation_triggers` (`automation_id`);--> statement-breakpoint
CREATE TABLE `automations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` integer NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`status` text DEFAULT 'enabled' NOT NULL,
	`model_provider_id` text,
	`model_id` text,
	`last_scheduled_at` integer,
	`last_run_at` integer,
	`last_completed_at` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `automations_workspace_updated_at_idx` ON `automations` (`workspace_id`,`updated_at`);