/**
 * RotatingPlaceholder — Typewriter cycling placeholder text
 *
 * Renders an animated placeholder that types out suggestions one at a time,
 * pauses, then erases and types the next. Designed for the welcome screen
 * input bar to educate users on agent capabilities.
 *
 * Uses a CSS overlay approach so it works with any input component.
 */

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { dedupeQuestions } from '../suggestions/question-quality';

const GLOBAL_SUGGESTIONS = [
  'Ask me anything about your business...',
  'Ask me to help with analysis or insights...',
  'Ask me to draft a report or summary...',
];

/** Generate scope-aware placeholder suggestions from value stream metadata */
function getScopeSuggestions(
  scopeName?: string,
  scopeDesc?: string | null,
  scopeId?: string,
  generatedPrompts?: string[],
): string[] {
  if (generatedPrompts && generatedPrompts.length > 0) {
    const cleaned = dedupeQuestions(generatedPrompts, 3);
    if (cleaned.length > 0) return cleaned;
  }
  if (!scopeName || scopeId === 'global') return GLOBAL_SUGGESTIONS;
  if (scopeDesc) {
    return [
      `Ask me about ${scopeDesc.toLowerCase()}...`,
      `Ask me to analyze ${scopeName} data...`,
      `Ask me for ${scopeName} insights and trends...`,
    ];
  }
  return [
    `Ask me about ${scopeName} operations...`,
    `Ask me to analyze ${scopeName} data...`,
    `Ask me for ${scopeName} insights and trends...`,
  ];
}

const TYPE_SPEED = 40;       // ms per character
const PAUSE_DURATION = 2500; // ms to hold complete text
const ERASE_SPEED = 20;      // ms per character (faster erase)

interface RotatingPlaceholderProps {
  /** If true, the real input has text — hide the placeholder */
  hidden?: boolean;
  className?: string;
  /** Active value stream ID */
  scopeId?: string;
  /** Active value stream name — drives contextual suggestions */
  scopeName?: string;
  /** Active value stream description — enriches placeholder text */
  scopeDescription?: string | null;
  /** Optional LLM-generated prompts for the active stream */
  generatedPrompts?: string[];
}

export function RotatingPlaceholder({
  hidden = false,
  className,
  scopeId,
  scopeName,
  scopeDescription,
  generatedPrompts,
}: RotatingPlaceholderProps) {
  const suggestions = getScopeSuggestions(
    scopeName,
    scopeDescription,
    scopeId,
    generatedPrompts,
  );
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState('');
  const [phase, setPhase] = useState<'typing' | 'paused' | 'erasing'>('typing');

  // Reset animation when scope changes
  useEffect(() => {
    setCurrentIndex(0);
    setDisplayText('');
    setPhase('typing');
  }, [scopeName, generatedPrompts]);

  const currentSuggestion = suggestions[currentIndex % suggestions.length];

  useEffect(() => {
    if (hidden) return;

    let timeout: ReturnType<typeof setTimeout>;

    if (phase === 'typing') {
      if (displayText.length < currentSuggestion.length) {
        timeout = setTimeout(() => {
          setDisplayText(currentSuggestion.slice(0, displayText.length + 1));
        }, TYPE_SPEED);
      } else {
        timeout = setTimeout(() => setPhase('paused'), PAUSE_DURATION);
      }
    } else if (phase === 'paused') {
      timeout = setTimeout(() => setPhase('erasing'), 0);
    } else if (phase === 'erasing') {
      if (displayText.length > 0) {
        timeout = setTimeout(() => {
          setDisplayText(displayText.slice(0, -1));
        }, ERASE_SPEED);
      } else {
        setCurrentIndex((prev) => (prev + 1) % suggestions.length);
        setPhase('typing');
      }
    }

    return () => clearTimeout(timeout);
  }, [phase, displayText, currentSuggestion, hidden]);

  if (hidden) return null;

  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center ${className || ''}`}
      aria-hidden
    >
      <span
        className="text-muted-foreground/50 truncate"
        style={{
          fontSize: 15,
          fontWeight: 400,
          letterSpacing: '-0.01em',
        }}
      >
        {displayText}
        <motion.span
          animate={{ opacity: [1, 0] }}
          transition={{ duration: 0.6, repeat: Infinity, repeatType: 'reverse' }}
          className="inline-block w-[2px] h-[1.1em] align-middle ml-px"
          style={{ background: 'var(--primary)', opacity: 0.6 }}
        />
      </span>
    </div>
  );
}

export { GLOBAL_SUGGESTIONS as SUGGESTIONS };
