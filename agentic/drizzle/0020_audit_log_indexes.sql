-- Migration 0020: Add indexes for accessRequests + audit log table
-- Purpose: Query performance for manager access request listing + governance audit trail

-- 1. Indexes on accessRequests for common query patterns
CREATE INDEX `idx_accessRequests_status` ON `accessRequests` (`status`);
CREATE INDEX `idx_accessRequests_email` ON `accessRequests` (`email`);
CREATE INDEX `idx_accessRequests_createdAt` ON `accessRequests` (`createdAt`);
CREATE INDEX `idx_accessRequests_status_createdAt` ON `accessRequests` (`status`, `createdAt`);

-- 2. Audit log table for user management actions
CREATE TABLE IF NOT EXISTS `auditLog` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `actorId` int NOT NULL,
  `actorEmail` varchar(255) NOT NULL,
  `action` varchar(64) NOT NULL,
  `targetType` varchar(64) NOT NULL,
  `targetId` varchar(255) NOT NULL,
  `detail` text,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_auditLog_action` (`action`),
  INDEX `idx_auditLog_targetType_targetId` (`targetType`, `targetId`),
  INDEX `idx_auditLog_createdAt` (`createdAt`),
  INDEX `idx_auditLog_actorId` (`actorId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
