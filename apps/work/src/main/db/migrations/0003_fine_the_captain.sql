CREATE TABLE `session_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`session_id` integer NOT NULL,
	`entry_id` text NOT NULL,
	`entry_type` text NOT NULL,
	`payload` text NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_entries_session_entry_unique` ON `session_entries` (`session_id`,`entry_id`);--> statement-breakpoint
CREATE INDEX `session_entries_session_order_idx` ON `session_entries` (`session_id`,`id`);--> statement-breakpoint
CREATE INDEX `session_entries_session_type_order_idx` ON `session_entries` (`session_id`,`entry_type`,`id`);--> statement-breakpoint
DELETE FROM `sessions`;--> statement-breakpoint
DROP INDEX `sessions_agent_session_path_unique`;--> statement-breakpoint
ALTER TABLE `sessions` ADD `agent_session_id` text NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `sessions_agent_session_id_unique` ON `sessions` (`agent_session_id`);--> statement-breakpoint
ALTER TABLE `sessions` DROP COLUMN `agent_session_path`;
