ALTER TABLE `conversations` MODIFY COLUMN `createdAt` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `messages` MODIFY COLUMN `createdAt` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `thoughtTraceSteps` MODIFY COLUMN `createdAt` timestamp NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `createdAt` timestamp NOT NULL;