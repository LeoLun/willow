CREATE TABLE `session_context_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`model_id` text NOT NULL,
	`summary` text NOT NULL,
	`index_text` text NOT NULL,
	`compressed_until_message_id` integer NOT NULL,
	`source_message_count` integer NOT NULL,
	`estimated_tokens` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
