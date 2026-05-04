-- Fix: Cannot drop index 'PRIMARY': needed in a foreign key constraint
-- drizzle-kit push sees a PK diff on userValueStreams but can't drop PK
-- while FK constraints reference those columns. We handle the order manually.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Drop the FK constraints that reference the PK columns
ALTER TABLE `userValueStreams` DROP FOREIGN KEY `userValueStreams_userId_users_id_fk`;--> statement-breakpoint
ALTER TABLE `userValueStreams` DROP FOREIGN KEY `userValueStreams_valueStreamId_valueStreams_id_fk`;--> statement-breakpoint

-- Step 2: Drop and recreate the composite primary key
ALTER TABLE `userValueStreams` DROP PRIMARY KEY;--> statement-breakpoint
ALTER TABLE `userValueStreams` ADD PRIMARY KEY (`userId`, `valueStreamId`);--> statement-breakpoint

-- Step 3: Re-add the FK constraints
ALTER TABLE `userValueStreams` ADD CONSTRAINT `userValueStreams_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;--> statement-breakpoint
ALTER TABLE `userValueStreams` ADD CONSTRAINT `userValueStreams_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE ON UPDATE NO ACTION;
