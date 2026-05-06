-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0009: Gamification — Contributions, Badges, Streaks, Impact
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Adds platform-wide gamification tables to track user contributions,
-- award achievement badges, maintain streaks, measure document impact,
-- and provide stream-level health scores.
--
-- Tables:
--   knowledgeContributions  — Event log of every user action (upload, review, etc.)
--   knowledgeProfiles       — Per-user aggregated gamification state
--   knowledgeBadges         — Earned badges (one row per user per badge)
--   knowledgeDocumentImpact — Per-document lifetime citation/impact tracking
--   knowledgeStreamScores   — Materialized stream-level leaderboard scores
--
-- Dependencies: users, valueStreams (from migrations 0000, 0004)
-- Idempotent:   All CREATE TABLE use IF NOT EXISTS
-- Rollback:     See bottom of file
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── 1. Contribution Events ──────────────────────────────────────────────────
-- Every action a user takes in the knowledge base generates a contribution.
-- Points are pre-computed at write time (base × streak multiplier).
-- The `multiplier` column stores the value × 100 (e.g. 150 = 1.5x).

CREATE TABLE IF NOT EXISTS `knowledgeContributions` (
  `id`                  VARCHAR(64) NOT NULL,
  `userId`              INT NOT NULL,
  `valueStreamId`       VARCHAR(64),
  `contributionAction`  ENUM(
    'upload', 'review', 'approve', 'reject', 'update',
    'fill_gap', 'fix_contradiction', 'test_query',
    'report_error', 'invite', 'citation'
  ) NOT NULL,
  `documentId`          VARCHAR(64),
  `points`              INT NOT NULL DEFAULT 0,
  `multiplier`          INT NOT NULL DEFAULT 100,
  `metadata`            TEXT,
  `createdAt`           TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_kcontrib_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_kcontrib_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE INDEX `idx_kcontrib_user`      ON `knowledgeContributions` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_kcontrib_user_date`  ON `knowledgeContributions` (`userId`, `createdAt`);
--> statement-breakpoint
CREATE INDEX `idx_kcontrib_stream`     ON `knowledgeContributions` (`valueStreamId`);
--> statement-breakpoint

-- ── 2. Gamification Profiles ────────────────────────────────────────────────
-- Aggregated per-user state: total points, streak, counters.
-- One row per user. Created lazily on first contribution.
-- Streak logic: if lastContributionDate = yesterday → extend, gap → reset to 1.

CREATE TABLE IF NOT EXISTS `knowledgeProfiles` (
  `userId`                INT NOT NULL,
  `totalPoints`           INT NOT NULL DEFAULT 0,
  `currentStreak`         INT NOT NULL DEFAULT 0,
  `longestStreak`         INT NOT NULL DEFAULT 0,
  `lastContributionDate`  VARCHAR(10),          -- YYYY-MM-DD format
  `streakShieldAvailable` TINYINT NOT NULL DEFAULT 1,
  `totalUploads`          INT NOT NULL DEFAULT 0,
  `totalReviews`          INT NOT NULL DEFAULT 0,
  `totalCitations`        INT NOT NULL DEFAULT 0,
  `totalUsersHelped`      INT NOT NULL DEFAULT 0,
  `createdAt`             TIMESTAMP NOT NULL,
  `updatedAt`             TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`userId`),
  CONSTRAINT `fk_kprofile_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

-- ── 3. Earned Badges ────────────────────────────────────────────────────────
-- One row per user per badge. The badgeKey maps to the server-side
-- BADGE_CATALOG which defines icons, tiers, and check functions.
-- Badges are awarded by recordContribution() after every action.

CREATE TABLE IF NOT EXISTS `knowledgeBadges` (
  `id`        VARCHAR(64) NOT NULL,
  `userId`    INT NOT NULL,
  `badgeKey`  VARCHAR(100) NOT NULL,
  `badgeTier` ENUM('bronze', 'silver', 'gold', 'diamond', 'secret') NOT NULL,
  `metadata`  TEXT,                              -- JSON: how it was earned
  `earnedAt`  TIMESTAMP NOT NULL,
  PRIMARY KEY (`id`),
  CONSTRAINT `fk_kbadge_user`
    FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

CREATE INDEX `idx_kbadges_user` ON `knowledgeBadges` (`userId`);
--> statement-breakpoint
CREATE INDEX `idx_kbadges_key`  ON `knowledgeBadges` (`badgeKey`);
--> statement-breakpoint

-- ── 4. Document Impact ──────────────────────────────────────────────────────
-- Tracks per-document lifetime citation stats. Updated asynchronously
-- when the orchestrator cites a document in a response.
-- positiveRate is 0–100 (percentage of positive feedback).

CREATE TABLE IF NOT EXISTS `knowledgeDocumentImpact` (
  `documentId`        VARCHAR(64) NOT NULL,
  `uploaderId`        INT,
  `valueStreamId`     VARCHAR(64),
  `citationCount`     INT NOT NULL DEFAULT 0,
  `uniqueUsersHelped` INT NOT NULL DEFAULT 0,
  `positiveRate`      INT NOT NULL DEFAULT 0,
  `lastCitedAt`       TIMESTAMP NULL,
  `createdAt`         TIMESTAMP NOT NULL,
  `updatedAt`         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`documentId`),
  CONSTRAINT `fk_kdocimp_uploader`
    FOREIGN KEY (`uploaderId`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_kdocimp_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint

CREATE INDEX `idx_kdocimp_uploader` ON `knowledgeDocumentImpact` (`uploaderId`);
--> statement-breakpoint
CREATE INDEX `idx_kdocimp_stream`   ON `knowledgeDocumentImpact` (`valueStreamId`);
--> statement-breakpoint

-- ── 5. Stream Scores ────────────────────────────────────────────────────────
-- Materialized stream-level leaderboard. Refreshed periodically by a
-- background job that aggregates contributions, quality, freshness.
-- All scores are 0–100. teamBadges is a JSON array of badge keys.

CREATE TABLE IF NOT EXISTS `knowledgeStreamScores` (
  `valueStreamId`    VARCHAR(64) NOT NULL,
  `compositeScore`   INT NOT NULL DEFAULT 0,
  `coverageScore`    INT NOT NULL DEFAULT 0,
  `qualityScore`     INT NOT NULL DEFAULT 0,
  `freshnessScore`   INT NOT NULL DEFAULT 0,
  `contributorCount` INT NOT NULL DEFAULT 0,
  `activityScore`    INT NOT NULL DEFAULT 0,
  `rank`             INT NOT NULL DEFAULT 0,
  `teamBadges`       TEXT,                       -- JSON array
  `updatedAt`        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`valueStreamId`),
  CONSTRAINT `fk_kstreamscore_stream`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK (run manually if needed — Drizzle does not auto-rollback)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- DROP TABLE IF EXISTS `knowledgeStreamScores`;
-- DROP TABLE IF EXISTS `knowledgeDocumentImpact`;
-- DROP TABLE IF EXISTS `knowledgeBadges`;
-- DROP TABLE IF EXISTS `knowledgeProfiles`;
-- DROP TABLE IF EXISTS `knowledgeContributions`;
-- ═══════════════════════════════════════════════════════════════════════════════
