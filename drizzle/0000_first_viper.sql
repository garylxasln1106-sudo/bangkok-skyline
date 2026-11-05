CREATE TABLE `library_login_attempts` (
	`key` text PRIMARY KEY NOT NULL,
	`attempts` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_login_attempts_expiry_idx` ON `library_login_attempts` (`expires_at`);--> statement-breakpoint
CREATE TABLE `library_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `library_sessions_expiry_idx` ON `library_sessions` (`expires_at`);