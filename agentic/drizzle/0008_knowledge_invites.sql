-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0008: Knowledge Invites
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Invite value stream knowledge curators via email + short invite code.
-- Once accepted, the curator gains manager-level access to the stream's KB.
--
-- Dependencies: users (migration 0000), valueStreams (migration 0004)
-- Idempotent:   CREATE TABLE IF NOT EXISTS
-- Rollback:     See bottom of file
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS `knowledgeInvites` (
  `id`           VARCHAR(64) NOT NULL,
  `valueStreamId` VARCHAR(64) NOT NULL,
  `orgId`        VARCHAR(128) NOT NULL DEFAULT 'default',
  `email`        VARCHAR(320) NOT NULL,
  `inviteCode`   VARCHAR(16) NOT NULL,
  `inviteRole`   ENUM('manager','operator','viewer') NOT NULL DEFAULT 'manager',
  `inviteStatus` ENUM('pending','accepted','expired','revoked') NOT NULL DEFAULT 'pending',
  `note`         TEXT,
  `createdBy`    INT,
  `acceptedBy`   INT,
  `expiresAt`    TIMESTAMP NOT NULL,
  `acceptedAt`   TIMESTAMP NULL,
  `createdAt`    TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_kinvite_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kinvite_createdby`
    FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`),
  CONSTRAINT `fk_kinvite_acceptedby`
    FOREIGN KEY (`acceptedBy`) REFERENCES `users`(`id`),
  UNIQUE KEY `uniq_invite_code` (`inviteCode`)
);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS `idx_ki_stream` ON `knowledgeInvites` (`valueStreamId`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ki_email`  ON `knowledgeInvites` (`email`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_ki_code`   ON `knowledgeInvites` (`inviteCode`);
--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- DROP TABLE IF EXISTS `knowledgeInvites`;
-- ═══════════════════════════════════════════════════════════════════════════════
