PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_mcp_credentials` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` integer,
	`server_name` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_mcp_credentials`("key", "workspace_id", "server_name", "encrypted_data") SELECT "key", "workspace_id", "server_name", "encrypted_data" FROM `mcp_credentials`;--> statement-breakpoint
DROP TABLE `mcp_credentials`;--> statement-breakpoint
ALTER TABLE `__new_mcp_credentials` RENAME TO `mcp_credentials`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE TABLE `__new_mcp_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` integer,
	`server_name` text NOT NULL,
	`tools` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_mcp_metadata`("key", "workspace_id", "server_name", "tools") SELECT "key", "workspace_id", "server_name", "tools" FROM `mcp_metadata`;--> statement-breakpoint
DROP TABLE `mcp_metadata`;--> statement-breakpoint
ALTER TABLE `__new_mcp_metadata` RENAME TO `mcp_metadata`;