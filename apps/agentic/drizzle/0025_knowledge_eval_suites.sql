-- Migration 0025: maintained knowledge eval suites
-- Purpose: persist stream-scoped Validate test suites so regression runs are repeatable.

CREATE TABLE IF NOT EXISTS `knowledgeEvalSuites` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `name` varchar(128) NOT NULL,
  `origin` enum('curated','generated','fallback','manual') NOT NULL DEFAULT 'manual',
  `basedOnSnapshotId` varchar(64) DEFAULT NULL,
  `cases` text NOT NULL,
  `createdBy` int NOT NULL,
  `updatedBy` int DEFAULT NULL,
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_kb_eval_suites_stream` (`valueStreamId`),
  KEY `idx_kb_eval_suites_org` (`orgId`),
  KEY `idx_kb_eval_suites_time` (`valueStreamId`, `updatedAt`),
  KEY `idx_kb_eval_suites_name` (`valueStreamId`, `name`),
  CONSTRAINT `fk_knowledgeEvalSuites_valueStreamId`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_knowledgeEvalSuites_createdBy`
    FOREIGN KEY (`createdBy`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_knowledgeEvalSuites_updatedBy`
    FOREIGN KEY (`updatedBy`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
