/**
 * ThoughtTraceStream Component
 *
 * Category: thought-trace
 * Priority: P0 (Core)
 * Complexity: High
 *
 * Real-time streaming display of agent thought process.
 * - Enterprise Agentic UI aesthetics (glassmorphism, neural traces)
 * - CSS variable theming for light/dark mode
 * - Aria-live regions for accessibility
 * - Auto-scroll with user-override detection
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Brain, Loader2, CheckCircle2, XCircle, Pause, Play, ArrowDown } from 'lucide-react';
import { cn } from '../../../utils';

// ============================================================================
// Internal Cipher Component for Agentic Readouts
// ============================================================================
const CipherLabel = ({ text }: { text: string }) => {
  const [displayText, setDisplayText] = useState(text);
  
  useEffect(() => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';
    let iterations = 0;
    const interval = setInterval(() => {
      setDisplayText((prev) => 
        prev.split('').map((_, i) => {
          if (i < iterations) return text[i];
          return chars[Math.floor(Math.random() * chars.length)];
        }).join('')
      );
      iterations += 1 / 2; // Speed of decipher
      if (iterations >= text.length) clearInterval(interval);
    }, 40);
    return () => clearInterval(interval);
  }, [text]);

  return <span className="font-mono">{displayText}</span>;
};

// ============================================================================
// Types
// ============================================================================

export type StreamStatus = 'idle' | 'streaming' | 'paused' | 'complete' | 'error';

export interface ThoughtChunk {
  id: string;
  content: string;
  timestamp: string;
  type: 'thinking' | 'reasoning' | 'conclusion' | 'action';
}

export interface ThoughtTraceStreamProps {
  /** Array of thought chunks to display */
  chunks: ThoughtChunk[];
  /** Current stream status */
  status: StreamStatus;
  /** Title for the stream */
  title?: string;
  /** Whether to auto-scroll to new content */
  autoScroll?: boolean;
  /** Maximum height before scrolling */
  maxHeight?: number;
  /** Callback when pause/resume is toggled */
  onTogglePause?: () => void;
  /** Callback when stream is cleared */
  onClear?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Show timestamp for each chunk */
  showTimestamps?: boolean;
}

// ============================================================================
// Constants — CSS variable theming
// ============================================================================



const typeConfig: Record<ThoughtChunk['type'], { colorClass: string; bgClass: string; label: string }> = {
  thinking: { colorClass: 'text-primary', bgClass: 'bg-primary', label: 'Thinking' },
  reasoning: { colorClass: 'text-indigo-500 dark:text-indigo-400', bgClass: 'bg-indigo-500', label: 'Reasoning' },
  conclusion: { colorClass: 'text-emerald-600 dark:text-emerald-500', bgClass: 'bg-emerald-500', label: 'Conclusion' },
  action: { colorClass: 'text-amber-600 dark:text-amber-500', bgClass: 'bg-amber-500', label: 'Action' },
};

const statusConfig: Record<StreamStatus, {
  icon: React.ElementType;
  iconClass: string;
  badgeClass: string;
  label: string;
}> = {
  idle: {
    icon: Brain,
    iconClass: 'text-muted-foreground',
    badgeClass: 'bg-muted text-muted-foreground border-transparent',
    label: 'Idle',
  },
  streaming: {
    icon: Loader2,
    iconClass: 'text-primary animate-spin-slow',
    badgeClass: 'bg-primary/10 text-primary border-primary/20',
    label: 'Streaming',
  },
  paused: {
    icon: Pause,
    iconClass: 'text-amber-600 dark:text-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-500 border-amber-500/20',
    label: 'Paused',
  },
  complete: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-600 dark:text-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 border-emerald-500/20',
    label: 'Complete',
  },
  error: {
    icon: XCircle,
    iconClass: 'text-destructive',
    badgeClass: 'bg-destructive/10 text-destructive border-destructive/20',
    label: 'Error',
  },
};

// ============================================================================
// Main Component
// ============================================================================

export const ThoughtTraceStream: React.FC<ThoughtTraceStreamProps> = ({
  chunks,
  status,
  title = 'Agent Thinking',
  autoScroll = true,
  maxHeight = 400,
  onTogglePause,
  onClear,
  className,
  showTimestamps = false,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [userScrolled, setUserScrolled] = useState(false);
  const prevChunkCount = useRef(chunks.length);

  // Auto-scroll to bottom when new chunks arrive
  useEffect(() => {
    if (autoScroll && !userScrolled && scrollRef.current && chunks.length > prevChunkCount.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevChunkCount.current = chunks.length;
  }, [chunks.length, autoScroll, userScrolled]);

  // Detect user scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
    setUserScrolled(!isAtBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setUserScrolled(false);
    }
  }, []);

  const statusInfo = statusConfig[status];
  const StatusIcon = statusInfo.icon;
  const isStreaming = status === 'streaming';
  const isPaused = status === 'paused';

  // Get the latest chunk for screen reader announcement
  const latestChunk = chunks[chunks.length - 1];

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border border-border/50 shadow-md',
        'bg-card/40 backdrop-blur-xl',
        className
      )}
      data-component="ThoughtTraceStream"
    >
      {/* Background ambient glow for streaming status */}
      <AnimatePresence>
        {isStreaming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute -top-24 -left-24 w-64 h-64 rounded-full bg-primary/5 blur-3xl pointer-events-none"
          />
        )}
      </AnimatePresence>

      {/* Screen reader live region */}
      <div role="log" aria-live="polite" aria-atomic="false" aria-relevant="additions" className="sr-only">
        {latestChunk && (
          <span>{typeConfig[latestChunk.type].label}: {latestChunk.content}</span>
        )}
      </div>
      <div role="status" aria-live="assertive" aria-atomic="true" className="sr-only">
        {status === 'complete' && 'Agent thinking complete'}
        {status === 'error' && 'Agent encountered an error'}
        {status === 'paused' && 'Agent thinking paused'}
      </div>

      {/* Header */}
      <div className="relative flex items-center justify-between gap-3 px-5 py-3.5 border-b border-border/40 bg-muted/20">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            {isStreaming ? (
              <div className="relative flex h-5 w-5 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/40 opacity-75"></span>
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary"></span>
              </div>
            ) : (
              <StatusIcon className={cn('h-5 w-5', statusInfo.iconClass)} aria-hidden="true" />
            )}
          </div>
          <h3 className="font-semibold text-[13px] text-foreground tracking-wide uppercase">
            {title}
          </h3>
          <span className={cn('px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border', statusInfo.badgeClass)}>
            {statusInfo.label}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {(isStreaming || isPaused) && onTogglePause && (
            <button
              type="button"
              onClick={onTogglePause}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label={isPaused ? 'Resume stream' : 'Pause stream'}
            >
              {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
            </button>
          )}

          <AnimatePresence>
            {userScrolled && (
              <motion.button
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                type="button"
                onClick={scrollToBottom}
                className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md text-primary bg-primary/10 hover:bg-primary/20 transition-colors"
              >
                <ArrowDown className="h-3 w-3" />
                Latest
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Stream Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="relative overflow-y-auto px-5 py-6 space-y-4"
        style={{ maxHeight }}
        role="log"
        aria-label="Agent thought stream"
      >
        {/* Continuous Neural Trace Line */}
        {chunks.length > 0 && (
          <div className="absolute left-[29px] top-6 bottom-6 w-px bg-gradient-to-b from-border/80 via-border/30 to-transparent" />
        )}

        {chunks.length === 0 ? (
          <div className="text-center py-10 flex flex-col items-center gap-3 text-muted-foreground">
            {status === 'idle' ? (
              <p className="text-sm">Awaiting instructions...</p>
            ) : (
              <>
                <div className="relative flex h-8 w-8 items-center justify-center">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary/20 opacity-75"></span>
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-primary/80"></span>
                </div>
                <p className="text-sm font-medium text-foreground/70 animate-pulse">Initializing reasoning engine...</p>
              </>
            )}
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chunks.map((chunk, index) => {
              const config = typeConfig[chunk.type];
              const isLatest = index === chunks.length - 1;

              return (
                <motion.div
                  key={chunk.id}
                  initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
                  className="relative pl-7 group"
                >
                  {/* Node Dot */}
                  <div className={cn(
                    "absolute left-[1px] top-1.5 w-2 h-2 rounded-full shadow-sm ring-4 ring-card transition-colors duration-500",
                    isLatest && isStreaming ? 'bg-primary ring-primary/20 animate-pulse' : 'bg-border group-hover:bg-primary/50'
                  )} />

                  <div className="flex items-center gap-2 mb-1.5">
                    <span className={cn("text-[10px] font-bold uppercase tracking-wider", config.colorClass)}>
                      <CipherLabel text={config.label} />
                    </span>
                    {showTimestamps && (
                      <time className="text-[10px] text-muted-foreground/60 font-medium">
                        {new Date(chunk.timestamp).toLocaleTimeString()}
                      </time>
                    )}
                  </div>
                  <p className="text-[13px] whitespace-pre-wrap leading-relaxed text-foreground/90 font-medium font-mono tracking-tight">
                    {chunk.content}
                    {isLatest && isStreaming && (
                      <span className="inline-block w-2h-3.5 ml-1.5 align-middle bg-primary/70 animate-pulse rounded-sm shadow-[0_0_8px_var(--color-primary)]" />
                    )}
                  </p>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      {chunks.length > 0 && (
        <div className="flex items-center justify-between px-5 py-2.5 text-[11px] font-medium border-t border-border/40 bg-muted/10 text-muted-foreground/70">
          <span>{chunks.length} thought{chunks.length !== 1 ? 's' : ''} traversed</span>
          {onClear && status !== 'streaming' && (
            <button type="button" onClick={onClear} className="hover:text-foreground transition-colors">
              Clear trace
            </button>
          )}
        </div>
      )}
    </div>
  );
};

ThoughtTraceStream.displayName = 'ThoughtTraceStream';

export default ThoughtTraceStream;
