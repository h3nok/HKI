-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0007: Knowledge Collections
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Links value streams to subsets of the knowledge base.
-- Each collection maps to a department/tag filter for stream-scoped retrieval.
-- When a user queries within a stream, retrieval is scoped to the
-- stream's collections via the `department` field.
--
-- Dependencies: valueStreams (from migration 0004)
-- Idempotent:   CREATE TABLE IF NOT EXISTS
-- Rollback:     See bottom of file
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `knowledgeCollections` (
  `id`             VARCHAR(64) NOT NULL,
  `valueStreamId`  VARCHAR(64) NOT NULL,
  `orgId`          VARCHAR(128) NOT NULL DEFAULT 'default',
  `name`           VARCHAR(128) NOT NULL,
  `description`    TEXT,
  `department`     VARCHAR(64),
  `defaultDocType` VARCHAR(32) DEFAULT 'general',
  `autoTags`       TEXT,
  `isActive`       TINYINT NOT NULL DEFAULT 1,
  `createdAt`      TIMESTAMP NOT NULL,
  `updatedAt`      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_kcoll_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_kc_stream` ON `knowledgeCollections` (`valueStreamId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_kc_org`    ON `knowledgeCollections` (`orgId`);
--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- DROP TABLE IF EXISTS `knowledgeCollections`;
-- ═══════════════════════════════════════════════════════════════════════════════
