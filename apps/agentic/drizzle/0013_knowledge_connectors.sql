-- Knowledge Connectors — External source sync configuration
-- OAuth tokens encrypted at rest, sync state tracked per connector

CREATE TABLE IF NOT EXISTS `knowledgeConnectors` (
  `id` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `createdBy` int NOT NULL,
  `type` enum('google_drive','sharepoint','s3','confluence','notion') NOT NULL,
  `name` varchar(128) NOT NULL,
  `status` enum('active','paused','error','revoked') NOT NULL DEFAULT 'active',
  
  -- OAuth credentials (encrypted)
  `credentialsEncrypted` text NOT NULL,
  `credentialsVersion` int NOT NULL DEFAULT 1,
  
  -- Sync configuration
  `config` json NOT NULL,
  -- Example: {"folderId": "abc123", "folderName": "SOPs", "includeSubfolders": true, "mimeTypes": ["application/pdf", "text/plain"]}
  
  -- Sync state
  `syncIntervalMinutes` int NOT NULL DEFAULT 30,
  `lastSyncAt` timestamp NULL DEFAULT NULL,
  `lastSyncToken` varchar(255) DEFAULT NULL, -- Drive changes.list page token
  `lastSyncStats` json DEFAULT NULL,
  -- Example: {"filesProcessed": 12, "filesFailed": 1, "bytesDownloaded": 5242880, "durationMs": 45000}
  
  -- Error tracking (last N errors stored)
  `lastErrorAt` timestamp NULL DEFAULT NULL,
  `lastErrorMessage` text DEFAULT NULL,
  `consecutiveErrors` int NOT NULL DEFAULT 0,
  
  -- Metadata
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  PRIMARY KEY (`id`),
  KEY `idx_connectors_org` (`orgId`),
  KEY `idx_connectors_user` (`createdBy`),
  KEY `idx_connectors_status` (`status`),
  KEY `idx_connectors_type` (`type`),
  KEY `idx_connectors_sync` (`status`, `lastSyncAt`), -- For worker polling
  
  CONSTRAINT `knowledgeConnectors_createdBy_users_id_fk` FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Connector sync history — audit trail for each sync run
CREATE TABLE IF NOT EXISTS `knowledgeConnectorSyncs` (
  `id` varchar(64) NOT NULL,
  `connectorId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  
  -- Sync run details
  `startedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completedAt` timestamp NULL DEFAULT NULL,
  `status` enum('running','completed','failed','partial') NOT NULL DEFAULT 'running',
  
  -- Detailed stats
  `filesDiscovered` int NOT NULL DEFAULT 0,
  `filesProcessed` int NOT NULL DEFAULT 0,
  `filesFailed` int NOT NULL DEFAULT 0,
  `filesSkipped` int NOT NULL DEFAULT 0,
  `bytesDownloaded` bigint NOT NULL DEFAULT 0,
  
  -- Error log (JSON array of failed files)
  `errors` json DEFAULT NULL,
  -- Example: [{"fileId": "abc", "name": "doc.pdf", "error": "download_timeout", "retryCount": 3}]
  
  -- Performance metrics
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
