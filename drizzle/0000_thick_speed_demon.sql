CREATE TABLE `anniversary` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`year` integer NOT NULL,
	`month` integer NOT NULL,
	`day` integer NOT NULL,
	`name` text NOT NULL,
	`dayOff` integer DEFAULT 0 NOT NULL,
	`dayType` integer DEFAULT 0 NOT NULL,
	`historyType` integer DEFAULT 0 NOT NULL,
	`historyId` integer DEFAULT 0 NOT NULL,
	`del` integer DEFAULT false NOT NULL,
	`created` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `avatar_model` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`comment` text NOT NULL,
	`baseCharPrompt` text NOT NULL,
	`created` integer NOT NULL,
	`modelName` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `avatar_sns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`assignAvatarId` integer NOT NULL,
	`snsType` text(4) NOT NULL,
	`usageType` text(8) NOT NULL,
	`snsHandleName` text NOT NULL,
	`snsId` text NOT NULL,
	`checkedPostId` text NOT NULL,
	`created` integer NOT NULL,
	`lang` text(4) NOT NULL,
	`configId` integer NOT NULL,
	`enable` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `env_kv` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`created` integer NOT NULL,
	`updated` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_abroad_route` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`html_instructions` text NOT NULL,
	`maneuver` text NOT NULL,
	`duration` integer NOT NULL,
	`terminalStart` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_avatar` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`modelId` integer NOT NULL,
	`created` integer NOT NULL,
	`enable` integer DEFAULT false NOT NULL,
	`nextStayTime` integer,
	`lang` text NOT NULL,
	`currentRoute` text
);
--> statement-breakpoint
CREATE TABLE `run_terminal` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`country` text NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`lat` real DEFAULT 0 NOT NULL,
	`lng` real DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_history` (
	`seq` integer NOT NULL,
	`tripId` integer NOT NULL,
	`lng` real NOT NULL,
	`lat` real NOT NULL,
	`elapsed` integer NOT NULL,
	`address` text DEFAULT 'NULL',
	`imagePath` text DEFAULT 'NULL',
	`coursePath` text DEFAULT 'NULL',
	`placePath` text DEFAULT 'NULL',
	`plainPath` text DEFAULT 'NULL',
	`createTime` integer NOT NULL,
	`time` integer NOT NULL,
	`standOffsetX` integer DEFAULT 0 NOT NULL,
	`standOffsetY` integer DEFAULT 0 NOT NULL,
	`model` text DEFAULT 'NULL',
	`fitImage` integer DEFAULT 0 NOT NULL,
	`appendPrompt` text DEFAULT 'NULL',
	`pictAuthor` text DEFAULT 'NULL'
);
--> statement-breakpoint
CREATE UNIQUE INDEX `UQ_seq` ON `run_history` (`seq`);--> statement-breakpoint
CREATE TABLE `run_status` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`avatarId` integer DEFAULT 1 NOT NULL,
	`tripId` integer DEFAULT 0 NOT NULL,
	`start` text NOT NULL,
	`epoch` integer DEFAULT 0 NOT NULL,
	`tilEndEpoch` integer DEFAULT 0 NOT NULL,
	`status` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`destination` text,
	`startLat` real NOT NULL,
	`startLng` real NOT NULL,
	`endLat` real NOT NULL,
	`endLng` real NOT NULL,
	`durationSec` integer NOT NULL,
	`distanceM` integer NOT NULL,
	`duration` text NOT NULL,
	`startTime` integer NOT NULL,
	`startCountry` text(4) DEFAULT 'NULL',
	`endCountry` text(4) DEFAULT 'NULL',
	`startTz` text DEFAULT 'NULL',
	`endTz` text DEFAULT 'NULL',
	`currentPathNo` integer DEFAULT 0 NOT NULL,
	`currentStepNo` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sns_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`snsType` text(2) NOT NULL,
	`snsPostId` text NOT NULL,
	`snsReplyId` text DEFAULT 'NULL',
	`postType` integer NOT NULL,
	`sendUserId` text NOT NULL,
	`info` text DEFAULT 'NULL',
	`del` integer NOT NULL,
	`createTime` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `test_tab` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`issue_id` text NOT NULL,
	`comment` text,
	`del` integer DEFAULT false NOT NULL,
	`created` integer NOT NULL
);
