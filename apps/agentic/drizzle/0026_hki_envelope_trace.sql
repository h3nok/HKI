-- Migration 0026: Persist HKI envelope trace events

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
    'hki_envelope',
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
