CREATE TABLE `statistics_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`workspace_id` integer,
	`session_id` text,
	`started_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `statistics_runs_source_started_at_idx` ON `statistics_runs` (`source`,`started_at`);--> statement-breakpoint
CREATE INDEX `statistics_runs_started_at_idx` ON `statistics_runs` (`started_at`);--> statement-breakpoint
CREATE TABLE `statistics_usage` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`run_id` integer NOT NULL,
	`provider_id` text NOT NULL,
	`provider_name` text NOT NULL,
	`model_id` text NOT NULL,
	`model_name` text NOT NULL,
	`input_tokens` integer NOT NULL,
	`output_tokens` integer NOT NULL,
	`cache_read_tokens` integer NOT NULL,
	`cache_write_tokens` integer NOT NULL,
	`total_tokens` integer NOT NULL,
	`input_cost` real NOT NULL,
	`output_cost` real NOT NULL,
	`cache_read_cost` real NOT NULL,
	`cache_write_cost` real NOT NULL,
	`total_cost` real NOT NULL,
	`occurred_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `statistics_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `statistics_usage_occurred_at_idx` ON `statistics_usage` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `statistics_usage_model_occurred_at_idx` ON `statistics_usage` (`provider_id`,`model_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `statistics_usage_run_id_idx` ON `statistics_usage` (`run_id`);