ALTER TABLE `avatar_sns` ADD `mentionPostId` text NOT NULL;--> statement-breakpoint
ALTER TABLE `avatar_sns` DROP COLUMN `usageType`;--> statement-breakpoint
ALTER TABLE `avatar_sns` DROP COLUMN `lang`;--> statement-breakpoint
ALTER TABLE `avatar_sns` DROP COLUMN `configId`;