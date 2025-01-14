DROP TABLE `test_tab`;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_avatar_sns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignAvatarId` integer NOT NULL,
	`snsType` text(4) NOT NULL,
	`snsHandleName` text NOT NULL,
	`snsId` text NOT NULL,
	`checkedPostId` integer DEFAULT 0 NOT NULL,
	`mentionPostId` integer DEFAULT 0 NOT NULL,
	`created` integer NOT NULL,
	`enable` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_avatar_sns`("id", "assignAvatarId", "snsType", "snsHandleName", "snsId", "checkedPostId", "mentionPostId", "created", "enable") SELECT "id", "assignAvatarId", "snsType", "snsHandleName", "snsId", "checkedPostId", "mentionPostId", "created", "enable" FROM `avatar_sns`;--> statement-breakpoint
DROP TABLE `avatar_sns`;--> statement-breakpoint
ALTER TABLE `__new_avatar_sns` RENAME TO `avatar_sns`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `run_status` ADD `endTime` integer;