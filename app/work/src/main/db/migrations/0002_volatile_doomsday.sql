CREATE TABLE `models` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`model_id` text NOT NULL,
	`name` text NOT NULL,
	`api` text NOT NULL,
	`provider` text NOT NULL,
	`base_url` text NOT NULL,
	`api_key` text,
	`reasoning` integer DEFAULT false NOT NULL,
	`context_window` integer DEFAULT 64000 NOT NULL,
	`max_tokens` integer DEFAULT 8192 NOT NULL,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
