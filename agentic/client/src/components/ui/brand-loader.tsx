/**
 * BrandLoader — Reusable HKI-branded loading indicator
 *
 * Uses the same animated "C" + orbital from ThinkingAnimation to provide a
 * consistent brand signal across every loading state in the app:
 *
 *  • Full-screen app bootstrap   (variant="fullscreen")
 *  • Inline content loading      (variant="inline")
 *  • Compact sidebar / card      (variant="compact")
 *
 * This is the SINGLE SOURCE OF TRUTH for loading UI. If you need a loading
 * state anywhere, import this — don't roll a custom spinner.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ThinkingAnimation } from '@/components/chat-ui/ui/thinking-animation';
import { useEffect, useState } from 'react';

// ── Rotating status messages for fullscreen loader ─────────────────────
const LOADING_MESSAGES = [
  'Initializing Agent Core…',
  'Loading Agent Modules…',
  'Connecting to Knowledge Graph…',
  'Syncing Context Vectors…',
  'Optimizing Inference Engine…',
];

// ── Types ──────────────────────────────────────────────────────────────
export type BrandLoaderVariant = 'fullscreen' | 'inline' | 'compact';

export interface BrandLoaderProps {
  /** Visual size/layout preset */
  variant?: BrandLoaderVariant;
  /** Static message shown below the animation (overrides rotating messages) */
  message?: string;
  /** Extra Tailwind classes on the outermost wrapper */
  className?: string;
}

// ── Component ──────────────────────────────────────────────────────────
export function BrandLoader({
  variant = 'inline',
  message,
  className = '',
}: BrandLoaderProps) {
  // Rotating messages only used in fullscreen mode when no static message
  const [msgIndex, setMsgIndex] = useState(0);
  useEffect(() => {
    if (variant !== 'fullscreen' || message) return;
    const timer = setInterval(() => setMsgIndex(i => (i + 1) % LOADING_MESSAGES.length), 2200);
    return () => clearInterval(timer);
  }, [variant, message]);

  /* ── fullscreen ───────────────────────────────────────────────────── */
  if (variant === 'fullscreen') {
    const displayMsg = message ?? LOADING_MESSAGES[msgIndex];
    return (
      <div
        className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-background transition-colors duration-500 overflow-hidden ${className}`}
      >
        {/* Ambient glow */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl opacity-50 animate-pulse" />
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 flex flex-col items-center"
        >
          {/* Branded HKI "C" animation */}
          <div className="mb-6">
            <ThinkingAnimation variant="expanded" showLabel={false} />
          </div>

          {/* Rotating status text */}
          <div className="h-6 flex items-center justify-center overflow-hidden relative w-72">
            <AnimatePresence mode="wait">
              <motion.p
                key={displayMsg}
                initial={{ y: 16, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -16, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="absolute text-xs font-medium text-muted-foreground uppercase tracking-widest text-center w-full"
              >
                {displayMsg}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* Progress bar */}
          <div className="w-48 h-1 bg-muted rounded-full mt-6 overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{ background: 'linear-gradient(90deg, var(--secondary), var(--primary))' }}
              animate={{ width: ['0%', '100%'] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
        </motion.div>
      </div>
    );
  }

  /* ── inline — centered column with optional message ───────────────── */
  if (variant === 'inline') {
    return (
      <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
        <ThinkingAnimation
          variant="standard"
          label={message ?? 'Loading…'}
          showLabel={!!message}
        />
        {!message && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-3 text-xs text-muted-foreground"
          >
            Loading…
          </motion.p>
        )}
      </div>
    );
  }

  /* ── compact — small horizontal pill for sidebars / cards ─────────── */
  return (
    <div className={`flex items-center gap-2 px-3 py-2 ${className}`}>
      <ThinkingAnimation variant="minimal" showLabel={false} />
      {message && (
        <span className="text-xs text-muted-foreground">{message}</span>
      )}
    </div>
  );
}
