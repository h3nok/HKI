-- Idempotent table creation for all tables in drizzle/schema.ts.
-- drizzle-kit push (0.31.x) silently skips CREATE TABLE in non-interactive mode,
-- so we run this BEFORE push to ensure all tables exist.
-- Push then handles ALTER diffs only.

CREATE TABLE IF NOT EXISTS `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `openId` varchar(64) NOT NULL,
  `name` text,
  `email` varchar(320) DEFAULT NULL,
  `loginMethod` varchar(64) DEFAULT NULL,
  `pngId` varchar(32) DEFAULT NULL,
  `role` enum('admin','manager','operator','viewer') NOT NULL DEFAULT 'viewer',
  `department` varchar(128) DEFAULT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `valueStreams` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `lastSignedIn` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `users_openId_unique` (`openId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `valueStreams` (
  `id` varchar(64) NOT NULL,
  `name` varchar(128) NOT NULL,
  `description` text,
  `icon` varchar(8) NOT NULL DEFAULT '🏢',
  `sampleQuestions` text,
  `systemPrompt` text,
  `retrievalStrategy` varchar(16) DEFAULT 'hybrid',
  `enabledTools` text,
  `guardrailConfig` text,
  `memoryConfig` text,
  `knowledgeConfig` text,
  `llmApiKey` text,
  `monthlyTokenBudget` int DEFAULT NULL,
  `monthlyTokenUsed` int DEFAULT 0,
  `billingPeriod` varchar(7) DEFAULT NULL,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `userValueStreams` (
  `userId` int NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `assignedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`,`valueStreamId`),
  KEY `userValueStreams_valueStreamId_valueStreams_id_fk` (`valueStreamId`),
  CONSTRAINT `userValueStreams_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `userValueStreams_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeCollections` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `name` varchar(128) NOT NULL,
  `description` text,
  `department` varchar(64) DEFAULT NULL,
  `defaultDocType` varchar(32) DEFAULT 'general',
  `autoTags` text,
  `isActive` tinyint NOT NULL DEFAULT 1,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kc_stream` (`valueStreamId`),
  KEY `idx_kc_org` (`orgId`),
  CONSTRAINT `knowledgeCollections_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeInvites` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `email` varchar(320) NOT NULL,
  `inviteCode` varchar(16) NOT NULL,
  `inviteRole` enum('manager','operator','viewer') NOT NULL DEFAULT 'manager',
  `inviteStatus` enum('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  `note` text,
  `createdBy` int DEFAULT NULL,
  `acceptedBy` int DEFAULT NULL,
  `expiresAt` timestamp NOT NULL,
  `acceptedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `knowledgeInvites_inviteCode_unique` (`inviteCode`),
  KEY `idx_ki_stream` (`valueStreamId`),
  KEY `idx_ki_email` (`email`),
  KEY `idx_ki_code` (`inviteCode`),
  CONSTRAINT `knowledgeInvites_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE,
  CONSTRAINT `knowledgeInvites_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`),
  CONSTRAINT `knowledgeInvites_acceptedBy_users_id_fk` FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `projects` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `name` varchar(200) NOT NULL,
  `emoji` varchar(8) NOT NULL DEFAULT '📁',
  `color` varchar(32) DEFAULT NULL,
  `sortOrder` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `projects_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `conversations` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `projectId` varchar(64) DEFAULT NULL,
  `scope` varchar(64) NOT NULL DEFAULT 'global',
  `title` text,
  `isPinned` tinyint NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_conversations_userId_updatedAt` (`userId`,`updatedAt`),
  KEY `idx_conversations_projectId` (`projectId`),
  CONSTRAINT `conversations_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `conversations_projectId_projects_id_fk` FOREIGN KEY (`projectId`) REFERENCES `projects`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `messages` (
  `id` varchar(64) NOT NULL,
  `conversationId` varchar(64) NOT NULL,
  `role` enum('user','assistant','system') NOT NULL,
  `content` text NOT NULL,
  `thoughtTrace` text,
  `toolCalls` text,
  `citations` text,
  `confidence` int DEFAULT NULL,
  `guardrails` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_messages_conversationId_createdAt` (`conversationId`,`createdAt`),
  CONSTRAINT `messages_conversationId_conversations_id_fk` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `thoughtTraceSteps` (
  `id` varchar(64) NOT NULL,
  `messageId` varchar(64) NOT NULL,
  `step` int NOT NULL,
  `type` enum('thinking','planning','executing','reflecting','routing','tool_call','tool_result','guardrail','handoff','memory_recall','memory_store','knowledge_retrieval','cache_hit','final_response','suggested_follow_ups','plan_generated','step_started','step_verifying','step_verified','step_failed','replanning','human_escalation','rollback','scratchpad_update') NOT NULL,
  `content` text NOT NULL,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_thoughtTraceSteps_messageId_step` (`messageId`,`step`),
  CONSTRAINT `thoughtTraceSteps_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `toolExecutions` (
  `id` varchar(64) NOT NULL,
  `messageId` varchar(64) NOT NULL,
  `toolName` varchar(128) NOT NULL,
  `input` text NOT NULL,
  `output` text,
  `status` enum('pending','running','success','error') NOT NULL,
  `error` text,
  `startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_toolExecutions_messageId` (`messageId`),
  CONSTRAINT `toolExecutions_messageId_messages_id_fk` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ═══ Gamification tables ═══

CREATE TABLE IF NOT EXISTS `knowledgeContributions` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `valueStreamId` varchar(64) DEFAULT NULL,
  `contributionAction` enum('upload','review','approve','reject','update','fill_gap','fix_contradiction','test_query','report_error','invite','citation') NOT NULL,
  `documentId` varchar(64) DEFAULT NULL,
  `points` int NOT NULL DEFAULT 0,
  `multiplier` int NOT NULL DEFAULT 100,
  `metadata` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kcontrib_user` (`userId`),
  KEY `idx_kcontrib_user_date` (`userId`,`createdAt`),
  KEY `idx_kcontrib_stream` (`valueStreamId`),
  CONSTRAINT `knowledgeContributions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `knowledgeContributions_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeProfiles` (
  `userId` int NOT NULL,
  `totalPoints` int NOT NULL DEFAULT 0,
  `currentStreak` int NOT NULL DEFAULT 0,
  `longestStreak` int NOT NULL DEFAULT 0,
  `lastContributionDate` varchar(10) DEFAULT NULL,
  `streakShieldAvailable` tinyint NOT NULL DEFAULT 1,
  `totalUploads` int NOT NULL DEFAULT 0,
  `totalReviews` int NOT NULL DEFAULT 0,
  `totalCitations` int NOT NULL DEFAULT 0,
  `totalUsersHelped` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`),
  CONSTRAINT `knowledgeProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeBadges` (
  `id` varchar(64) NOT NULL,
  `userId` int NOT NULL,
  `badgeKey` varchar(100) NOT NULL,
  `badgeTier` enum('bronze','silver','gold','diamond','secret') NOT NULL,
  `metadata` text,
  `earnedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kbadges_user` (`userId`),
  KEY `idx_kbadges_key` (`badgeKey`),
  CONSTRAINT `knowledgeBadges_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeDocumentImpact` (
  `documentId` varchar(64) NOT NULL,
  `uploaderId` int DEFAULT NULL,
  `valueStreamId` varchar(64) DEFAULT NULL,
  `citationCount` int NOT NULL DEFAULT 0,
  `uniqueUsersHelped` int NOT NULL DEFAULT 0,
  `positiveRate` int NOT NULL DEFAULT 0,
  `lastCitedAt` timestamp NULL DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`documentId`),
  KEY `idx_kdocimp_uploader` (`uploaderId`),
  KEY `idx_kdocimp_stream` (`valueStreamId`),
  CONSTRAINT `knowledgeDocumentImpact_uploaderId_users_id_fk` FOREIGN KEY (`uploaderId`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `knowledgeDocumentImpact_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeStreamScores` (
  `valueStreamId` varchar(64) NOT NULL,
  `compositeScore` int NOT NULL DEFAULT 0,
  `coverageScore` int NOT NULL DEFAULT 0,
  `qualityScore` int NOT NULL DEFAULT 0,
  `freshnessScore` int NOT NULL DEFAULT 0,
  `contributorCount` int NOT NULL DEFAULT 0,
  `activityScore` int NOT NULL DEFAULT 0,
  `rank` int NOT NULL DEFAULT 0,
  `teamBadges` text,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`valueStreamId`),
  CONSTRAINT `knowledgeStreamScores_valueStreamId_valueStreams_id_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ═══ Knowledge Connectors (Google Drive, SharePoint, etc.) ═══

CREATE TABLE IF NOT EXISTS `knowledgeConnectors` (
  `id` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `createdBy` int NOT NULL,
  `type` enum('google_drive','sharepoint','s3','confluence','notion') NOT NULL,
  `name` varchar(128) NOT NULL,
  `status` enum('active','paused','error','revoked') NOT NULL DEFAULT 'active',
  `credentialsEncrypted` text NOT NULL,
  `credentialsVersion` int NOT NULL DEFAULT 1,
  `config` text NOT NULL,
  `syncIntervalMinutes` int NOT NULL DEFAULT 30,
  `lastSyncAt` timestamp NULL DEFAULT NULL,
  `lastSyncToken` varchar(255) DEFAULT NULL,
  `lastSyncStats` text DEFAULT NULL,
  `lastErrorAt` timestamp NULL DEFAULT NULL,
  `lastErrorMessage` text DEFAULT NULL,
  `consecutiveErrors` int NOT NULL DEFAULT 0,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_connectors_org` (`orgId`),
  KEY `idx_connectors_user` (`createdBy`),
  KEY `idx_connectors_status` (`status`),
  KEY `idx_connectors_type` (`type`),
  KEY `idx_connectors_sync` (`status`,`lastSyncAt`),
  CONSTRAINT `knowledgeConnectors_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeConnectorSyncs` (
  `id` varchar(64) NOT NULL,
  `connectorId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL DEFAULT NULL,
  `status` enum('running','completed','failed','partial') NOT NULL DEFAULT 'running',
  `filesDiscovered` int NOT NULL DEFAULT 0,
  `filesProcessed` int NOT NULL DEFAULT 0,
  `filesFailed` int NOT NULL DEFAULT 0,
  `filesSkipped` int NOT NULL DEFAULT 0,
  `bytesDownloaded` bigint NOT NULL DEFAULT 0,
  `errors` text DEFAULT NULL,
  `durationMs` int DEFAULT NULL,
  `apiCalls` int NOT NULL DEFAULT 0,
  `rateLimitHits` int NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  KEY `idx_syncs_connector` (`connectorId`),
  KEY `idx_syncs_org` (`orgId`),
  KEY `idx_syncs_status` (`status`),
  KEY `idx_syncs_time` (`startedAt`),
  CONSTRAINT `knowledgeConnectorSyncs_connectorId_knowledgeConnectors_id_fk` FOREIGN KEY (`connectorId`) REFERENCES `knowledgeConnectors`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeGapSnapshots` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `createdBy` int NOT NULL,
  `coverageScore` int NOT NULL,
  `coverageLabel` varchar(32) NOT NULL,
  `documentCount` int NOT NULL DEFAULT 0,
  `chunkCount` int NOT NULL DEFAULT 0,
  `summary` text NOT NULL,
  `strengths` text NOT NULL,
  `gaps` text NOT NULL,
  `staleContent` text NOT NULL,
  `recommendations` text NOT NULL,
  `note` text DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_gap_snapshots_stream` (`valueStreamId`),
  KEY `idx_gap_snapshots_org` (`orgId`),
  KEY `idx_gap_snapshots_time` (`valueStreamId`, `createdAt`),
  CONSTRAINT `knowledgeGapSnapshots_valueStreamId_fk` FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE,
  CONSTRAINT `knowledgeGapSnapshots_createdBy_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeAttestations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `attestedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `userName` varchar(256) DEFAULT NULL,
  `userEmail` varchar(320) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_ka_user_stream` (`userId`, `valueStreamId`),
  KEY `idx_ka_stream` (`valueStreamId`),
  CONSTRAINT `knowledgeAttestations_userId_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `knowledgeJourneyProgress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `userId` int NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `currentStep` varchar(64) NOT NULL,
  `completedSteps` text NOT NULL DEFAULT ('[]'),
  `completionTimestamps` text NOT NULL DEFAULT ('{}'),
  `dismissedBanners` text NOT NULL DEFAULT ('[]'),
  `journeyDismissed` tinyint NOT NULL DEFAULT 0,
  `lastActiveAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_journey_user_stream` (`userId`, `valueStreamId`),
  KEY `idx_journey_org` (`orgId`),
  KEY `idx_journey_active` (`lastActiveAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `accessRequests` (
  `id` int AUTO_INCREMENT NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `department` varchar(255) NOT NULL,
  `valueStream` varchar(255),
  `justification` text NOT NULL,
  `managerEmail` varchar(255),
  `status` enum('pending','approved','denied') NOT NULL DEFAULT 'pending',
  `reviewedBy` varchar(255),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `accessRequests_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
