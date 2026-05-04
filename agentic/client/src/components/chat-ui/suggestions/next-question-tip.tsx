/**
 * NextQuestionTip — Contextual follow-up suggestion pills
 *
 * Enterprise Defensive UI Patterns:
 * 1. Never crashes — wrapped in internal error boundary with graceful fallback
 * 2. Null-safe — handles undefined/empty messages, missing content types
 * 3. Auto-hides during streaming — no visual noise while agent is thinking
 * 4. Smooth transitions — AnimatePresence for enter/exit, stagger for pills
 * 5. Accessible — ARIA labels, keyboard navigation, focus management
 * 6. Context-aware — derives suggestions from conversation, falls back to static
 * 7. Disclaimer slot — optional "AI-generated" notice
 *
 * Usage:
 *   <NextQuestionTip
 *     messages={taskData?.messages ?? []}
 *     isStreaming={isAgentBusy}
 *     onSelect={handleSuggestion}
 *     showDisclaimer
 *   />
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare,
  ChevronRight,
} from 'lucide-react';
import { cn, ErrorBoundary } from '@hki/ui';
import { useFollowUpSuggestions, type FollowUpSuggestion } from './use-follow-up-suggestions';
import type { TaskMessage } from '../types';

// ═══════════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════════

export interface NextQuestionTipProps {
  /** All messages in the current conversation */
  messages: TaskMessage[];
  /** Whether the agent is currently streaming a response */
  isStreaming: boolean;
  /** Called when the user clicks a suggestion pill */
  onSelect: (text: string) => void;
  /** Show "AI-generated responses may not be accurate" disclaimer */
  showDisclaimer?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Maximum number of suggestions to show */
  maxSuggestions?: number;
  /** Scope-configured sample questions used as fallback suggestions */
  scopeSampleQuestions?: string[];
  /** LLM-generated follow-up suggestions from the orchestrator (preferred over heuristics) */
  orchestratorSuggestions?: string[];
}


// ═══════════════════════════════════════════════════════════════════════════════
// Animation Variants
// ═══════════════════════════════════════════════════════════════════════════════

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.15,
    },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15 },
  },
};

const pillVariants = {
  hidden: { opacity: 0, y: 8, scale: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
  exit: {
    opacity: 0,
    y: -4,
    scale: 0.98,
    transition: { duration: 0.12 },
  },
};

const disclaimerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { delay: 0.3, duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};


// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════

export function NextQuestionTip({
  messages,
  isStreaming,
  onSelect,
  showDisclaimer = false,
  className,
  maxSuggestions = 3,
  scopeSampleQuestions,
  orchestratorSuggestions,
}: NextQuestionTipProps) {
  return (
    <ErrorBoundary componentName="Suggestions" fallback={null}>
      <NextQuestionTipInner
        messages={messages}
        isStreaming={isStreaming}
        onSelect={onSelect}
        showDisclaimer={showDisclaimer}
        className={className}
        maxSuggestions={maxSuggestions}
        scopeSampleQuestions={scopeSampleQuestions}
        orchestratorSuggestions={orchestratorSuggestions}
      />
    </ErrorBoundary>
  );
}

/**
 * Inner component — separated so the error boundary can catch any hook/render errors
 */
function NextQuestionTipInner({
  messages,
  isStreaming,
  onSelect,
  showDisclaimer,
  className,
  maxSuggestions,
  scopeSampleQuestions,
  orchestratorSuggestions,
}: NextQuestionTipProps) {
  const { suggestions, isContextual } = useFollowUpSuggestions(
    messages ?? [],
    maxSuggestions,
    scopeSampleQuestions,
    orchestratorSuggestions,
  );

  // Don't show while streaming or before any agent response
  const hasAgentResponse = (messages ?? []).some(
    (m) => m.content.type === 'text' && m.content.author === 'agent',
  );

  // Only show orchestrator-generated suggestions when not streaming and there are results.
  // The orchestrator already knows conversation context — it won't generate follow-ups
  // when it's asking the user for clarification.
  const shouldShow = !isStreaming && hasAgentResponse && suggestions.length > 0;

  return (
    <div className={cn('w-full', className)}>
      <AnimatePresence mode="wait">
        {shouldShow && (
          <motion.div
            key="suggestions"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-col items-center gap-2"
            role="group"
            aria-label="Suggested follow-up questions"
          >
            {/* Suggestion Pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((suggestion) => (
                <SuggestionPill
                  key={suggestion.id}
                  suggestion={suggestion}
                  onSelect={onSelect}
                />
              ))}
            </div>

            {/* Disclaimer */}
            {showDisclaimer && (
              <motion.p
                variants={disclaimerVariants}
                className="text-[11px] text-muted-foreground/60 text-center select-none"
              >
                This uses AI and may produce inaccurate information.
                Verify important details.
              </motion.p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Suggestion Pill
// ═══════════════════════════════════════════════════════════════════════════════

interface SuggestionPillProps {
  suggestion: FollowUpSuggestion;
  onSelect: (text: string) => void;
}

function SuggestionPill({ suggestion, onSelect }: SuggestionPillProps) {
  const Icon = MessageSquare;

  return (
    <motion.button
      type="button"
      variants={pillVariants}
      onClick={() => onSelect(suggestion.text)}
      whileHover={{ y: -2, scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={cn(
        'group flex items-center gap-2 px-3.5 py-2 rounded-full',
        'text-[13px] font-medium text-foreground/80 hover:text-primary',
        'glass-chrome hover:bg-primary/8 hover:border-primary/30',
        'shadow-sm hover:shadow-md',
        'transition-all duration-150',
        'cursor-pointer select-none',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1',
      )}
      title={suggestion.text}
      aria-label={`Ask: ${suggestion.text}`}
    >
      <Icon className="w-3.5 h-3.5 text-primary/50 group-hover:text-primary transition-colors shrink-0" />
      <span className="whitespace-nowrap">{suggestion.label}</span>
      <ChevronRight className="w-3 h-3 text-primary/30 group-hover:text-primary/60 transition-colors shrink-0" />
    </motion.button>
  );
}
