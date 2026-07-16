CREATE TABLE `credentials` (
	`provider_id` text PRIMARY KEY NOT NULL,
	`encrypted_data` blob NOT NULL
);
