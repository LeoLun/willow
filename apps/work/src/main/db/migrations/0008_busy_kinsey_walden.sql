CREATE TABLE `mcp_credentials` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`server_name` text NOT NULL,
	`encrypted_data` blob NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mcp_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`server_name` text NOT NULL,
	`tools` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `mcp_trust` (
	`key` text PRIMARY KEY NOT NULL,
	`workspace_id` integer NOT NULL,
	`server_name` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade
);
