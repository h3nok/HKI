-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0006: Add agent definition columns to valueStreams
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Phase 1 of Knowledge Self-Service: allows admins to define per-stream
-- agent persona, retrieval strategy, tools, guardrails, and memory config.
--
-- All columns are nullable/defaulted so existing rows are unaffected.
-- JSON fields (enabledTools, guardrailConfig, memoryConfig) are stored as TEXT
-- and serialized/deserialized in the BFF server layer.
--
-- Dependencies: valueStreams (from migration 0004)
-- Rollback:     See bottom of file
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE `valueStreams`
  ADD COLUMN `systemPrompt` TEXT NULL AFTER `sampleQuestions`,
  ADD COLUMN `retrievalStrategy` VARCHAR(16) DEFAULT 'hybrid' AFTER `systemPrompt`,
  ADD COLUMN `enabledTools` TEXT NULL AFTER `retrievalStrategy`,
  ADD COLUMN `guardrailConfig` TEXT NULL AFTER `enabledTools`,
  ADD COLUMN `memoryConfig` TEXT NULL AFTER `guardrailConfig`;
--> statement-breakpoint

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROLLBACK
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- ALTER TABLE `valueStreams`
--   DROP COLUMN `memoryConfig`,
--   DROP COLUMN `guardrailConfig`,
--   DROP COLUMN `enabledTools`,
--   DROP COLUMN `retrievalStrategy`,
--   DROP COLUMN `systemPrompt`;
-- ═══════════════════════════════════════════════════════════════════════════════
