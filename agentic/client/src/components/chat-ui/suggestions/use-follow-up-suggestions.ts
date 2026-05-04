/**
 * useFollowUpSuggestions — Shows LLM-generated follow-up questions from the orchestrator.
 *
 * Primary source: orchestrator-generated follow-ups.
 * Fallback source: scope-aware sample questions (admin or auto-generated).
 */

import { useMemo } from 'react';
import type { TaskMessage } from '../types';
import { dedupeQuestions, toSuggestionLabel } from './question-quality';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface FollowUpSuggestion {
  id: string;
  text: string;
  /** Short label for the pill (≤30 chars) */
  label: string;
  /** Category for icon selection */
  category: 'inventory' | 'sales' | 'staffing' | 'supply' | 'analytics' | 'general';
  /** Why this suggestion was generated */
  source: 'orchestrator' | 'fallback';
}

export interface UseFollowUpSuggestionsResult {
  suggestions: FollowUpSuggestion[];
  /** Whether suggestions are derived from real context vs. static fallbacks */
  isContextual: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Returns orchestrator-generated follow-up suggestions, or nothing.
 *
 * @param messages All messages in the current conversation (unused — kept for API compat)
 * @param maxSuggestions Maximum number of suggestions to return (default 3)
 * @param scopeSampleQuestions Scope-aware fallback suggestions
 * @param orchestratorSuggestions LLM-generated follow-ups from the orchestrator
 */
export function useFollowUpSuggestions(
  _messages: TaskMessage[],
  maxSuggestions = 3,
  scopeSampleQuestions?: string[],
  orchestratorSuggestions?: string[],
): UseFollowUpSuggestionsResult {
  return useMemo(() => {
    const cleanOrchestrator = dedupeQuestions(
      orchestratorSuggestions ?? [],
      maxSuggestions,
    );
    if (cleanOrchestrator.length > 0) {
      return {
        suggestions: cleanOrchestrator.slice(0, maxSuggestions).map((q, i) => ({
          id: `orch-${i}`,
          label: toSuggestionLabel(q),
          text: q,
          category: 'general' as const,
          source: 'orchestrator' as const,
        })),
        isContextual: true,
      };
    }

    const cleanScope = dedupeQuestions(scopeSampleQuestions ?? [], maxSuggestions);
    if (cleanScope.length > 0) {
      return {
        suggestions: cleanScope.slice(0, maxSuggestions).map((q, i) => ({
          id: `scope-${i}`,
          label: toSuggestionLabel(q),
          text: q,
          category: 'general' as const,
          source: 'fallback' as const,
        })),
        isContextual: true,
      };
    }

    // No orchestrator and no scope prompts → show nothing
    return { suggestions: [], isContextual: false };
  }, [maxSuggestions, orchestratorSuggestions, scopeSampleQuestions]);
}
