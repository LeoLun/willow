CREATE TABLE `tavily_api_keys` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`api_key` text NOT NULL,
	`monthly_limit` integer DEFAULT 1000 NOT NULL,
	`current_month_usage` integer DEFAULT 0 NOT NULL,
	`usage_reset_month` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
