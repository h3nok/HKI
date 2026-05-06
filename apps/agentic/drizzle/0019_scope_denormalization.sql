-- Migration 0019: Denormalize scope into messages + toolExecutions, add valueStreamId to projects
-- Purpose: Enable direct stream-scoped queries for audit trails without costly JOINs through conversations

-- 1. Add scope column to messages (denormalized from conversations.scope)
ALTER TABLE `messages`
  ADD COLUMN `scope` varchar(64) DEFAULT 'global' NOT NULL AFTER `conversationId`;

-- Backfill existing messages with their conversation's scope
UPDATE `messages` m
  INNER JOIN `conversations` c ON m.`conversationId` = c.`id`
  SET m.`scope` = COALESCE(c.`scope`, 'global');

-- Index for stream-scoped message queries + audit
CREATE INDEX `idx_messages_scope_createdAt` ON `messages` (`scope`, `createdAt`);

-- 2. Add scope column to thoughtTraceSteps (denormalized via message → conversation)
ALTER TABLE `thoughtTraceSteps`
  ADD COLUMN `scope` varchar(64) DEFAULT 'global' NOT NULL AFTER `messageId`;

-- Backfill trace steps from their message's conversation scope
UPDATE `thoughtTraceSteps` t
  INNER JOIN `messages` m ON t.`messageId` = m.`id`
  INNER JOIN `conversations` c ON m.`conversationId` = c.`id`
  SET t.`scope` = COALESCE(c.`scope`, 'global');

CREATE INDEX `idx_thoughtTraceSteps_scope` ON `thoughtTraceSteps` (`scope`);

-- 3. Add scope column to toolExecutions
ALTER TABLE `toolExecutions`
  ADD COLUMN `scope` varchar(64) DEFAULT 'global' NOT NULL AFTER `messageId`;

-- Backfill tool executions
UPDATE `toolExecutions` te
  INNER JOIN `messages` m ON te.`messageId` = m.`id`
  INNER JOIN `conversations` c ON m.`conversationId` = c.`id`
  SET te.`scope` = COALESCE(c.`scope`, 'global');

CREATE INDEX `idx_toolExecutions_scope` ON `toolExecutions` (`scope`);

-- 4. Add optional valueStreamId to projects for stream-aware organization
ALTER TABLE `projects`
  ADD COLUMN `valueStreamId` varchar(64) DEFAULT NULL AFTER `userId`;

CREATE INDEX `idx_projects_valueStreamId` ON `projects` (`valueStreamId`);
