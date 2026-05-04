-- ═══════════════════════════════════════════════════════════════════════════════
-- Migration 0018: Persist assistant provenance and prompt-stack traces
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Adds a dedicated JSON text column on messages for prompt/model/policy
-- provenance, and extends the thoughtTraceSteps.type enum so prompt_stack
-- events can be stored without truncation.
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE `messages`
  ADD COLUMN `provenance` text;

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
    'prompt_stack',
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
