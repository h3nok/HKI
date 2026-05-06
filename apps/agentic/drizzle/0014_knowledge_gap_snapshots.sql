-- Knowledge Gap Snapshots — versioned gap analysis history
-- Each Gemini "Analyze Gaps" run is persisted as an immutable snapshot.
-- Enables coverage trend tracking, before/after diffs, and audit trail.
-- Designed to be extensible: JSON columns hold full Gemini output.

CREATE TABLE IF NOT EXISTS `knowledgeGapSnapshots` (
  `id` varchar(64) NOT NULL,
  `valueStreamId` varchar(64) NOT NULL,
  `orgId` varchar(128) NOT NULL DEFAULT 'default',
  `createdBy` int NOT NULL,

  -- Coverage score (0–100) for efficient trend queries and charting
  `coverageScore` int NOT NULL,
  `coverageLabel` varchar(32) NOT NULL, -- "Low" | "Moderate" | "Good" | "Excellent"

  -- Context snapshot at time of run (for trend correlation)
  `documentCount` int NOT NULL DEFAULT 0,
  `chunkCount` int NOT NULL DEFAULT 0,

  -- Full Gemini output stored as JSON text columns
  -- Kept separate (not one big JSON blob) for partial reads and future indexing
  `summary` text NOT NULL,
  `strengths` text NOT NULL,       -- JSON: string[]
  `gaps` text NOT NULL,            -- JSON: {topic: string, severity: "high"|"medium"|"low", suggestion: string}[]
  `staleContent` text NOT NULL,    -- JSON: string[]
  `recommendations` text NOT NULL, -- JSON: string[]

  -- Optional user annotation added after reviewing the snapshot
  `note` text DEFAULT NULL,

  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),
  KEY `idx_gap_snapshots_stream` (`valueStreamId`),
  KEY `idx_gap_snapshots_org` (`orgId`),
  KEY `idx_gap_snapshots_time` (`valueStreamId`, `createdAt`),

  CONSTRAINT `knowledgeGapSnapshots_valueStreamId_fk`
    FOREIGN KEY (`valueStreamId`) REFERENCES `valueStreams`(`id`) ON DELETE CASCADE,
  CONSTRAINT `knowledgeGapSnapshots_createdBy_fk`
    FOREIGN KEY (`createdBy`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
