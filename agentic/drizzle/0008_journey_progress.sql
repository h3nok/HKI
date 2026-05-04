-- Migration: Add Knowledge Journey Progress tracking
-- Tracks user progress through the 8-step knowledge setup journey

CREATE TABLE IF NOT EXISTS `knowledgeJourneyProgress` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  
  -- Scope
  `userId` int NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  
  -- Progress State
  `currentStep` varchar(64) NOT NULL,
  `completedSteps` text NOT NULL DEFAULT ('[]'),
  `completionTimestamps` text NOT NULL DEFAULT ('{}'),
  
  -- Dismissal Tracking
  `dismissedBanners` text NOT NULL DEFAULT ('[]'),
  `journeyDismissed` tinyint NOT NULL DEFAULT 0,
  
  -- Lifecycle
  `lastActiveAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes
  INDEX `idx_journey_user_stream` (`userId`, `valueStreamId`),
  INDEX `idx_journey_org` (`orgId`),
  INDEX `idx_journey_active` (`lastActiveAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
