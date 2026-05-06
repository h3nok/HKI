-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0017: Expand thoughtTraceSteps.type ENUM
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The execution engine emits new step types (plan_generated, step_started, etc.)
-- that were added to schema.ts but never migrated to the database. The missing
-- values cause "Data truncated for column 'type'" on every agent response,
-- surfacing as "I encountered an internal error" to users.
--
-- This migration adds the full set of execution engine event types to the enum.
-- MODIFY COLUMN preserves all existing rows; MySQL validates them against the
-- new (larger) enum so no data is lost.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE `thoughtTraceSteps`
  MODIFY COLUMN `type` enum(
    'thinking',
    'planning',
    'executing',
    'reflecting',
    'routing',
    'tool_call',
    'tool_result',
    'guardrail',
    'handoff',
    'memory_recall',
    'memory_store',
    'knowledge_retrieval',
    'cache_hit',
    'final_response',
    'suggested_follow_ups',
    'plan_generated',
    'step_started',
    'step_verifying',
    'step_verified',
    'step_failed',
    'replanning',
    'human_escalation',
    'rollback',
    'scratchpad_update'
  ) NOT NULL;
