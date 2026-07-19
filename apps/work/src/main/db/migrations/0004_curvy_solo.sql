ALTER TABLE `workspaces` ADD `pinned` integer DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX `workspaces_pinned_updated_at_idx` ON `workspaces` (`pinned`,`updated_at`);