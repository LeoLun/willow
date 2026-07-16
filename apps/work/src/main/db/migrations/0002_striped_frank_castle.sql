CREATE TABLE `user_configs` (
	`id` integer PRIMARY KEY NOT NULL,
	`large_model_provider_id` text,
	`large_model_id` text,
	`small_model_provider_id` text,
	`small_model_id` text
);
