/**
 * StreamingMessage - Real-time Typewriter Effect Component
 * 
 * Displays agent responses with a typewriter effect as they stream in.
 * Supports markdown rendering and smooth character-by-character animation.
 * 
 * Features:
 * - Realistic typewriter effect with variable speed
 * - Markdown support with syntax highlighting
 * - Cursor blink animation
 * - Pause/resume streaming
 * - Complete callback when done
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, Square } from 'lucide-react';
import { Button } from '@hki/ui';
import { cn } from '@hki/ui';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

// ============================================================================
// TYPES
// ============================================================================

export interface StreamingMessageProps {
  content: string; // Full content to display
  isStreaming: boolean; // Whether content is still being received
  speed?: number; // Characters per second (default: 50)
  onComplete?: () => void;
  showControls?: boolean; // Show pause/play controls
  className?: string;
}

// ============================================================================
// COMPONENT
// ============================================================================

export function StreamingMessage({
  content,
  isStreaming,
  speed = 50,
  onComplete,
  showControls = false,
  className,
}: StreamingMessageProps) {
  const [displayedContent, setDisplayedContent] = useState('');
  const [isPaused, setIsPaused] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const indexRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout>(undefined);

  // Calculate delay between characters (in ms)
  const charDelay = 1000 / speed;

  // Typewriter effect
  useEffect(() => {
    // If already showing all content, mark as complete
    if (displayedContent === content && content.length > 0) {
      if (!isComplete) {
        setIsComplete(true);
        onComplete?.();
      }
      return;
    }

    // Don't animate if paused or not streaming
    if (isPaused || (!isStreaming && indexRef.current >= content.length)) {
      return;
    }

    // Clear existing timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Schedule next character
    if (indexRef.current < content.length) {
      timerRef.current = setTimeout(() => {
        indexRef.current += 1;
        setDisplayedContent(content.slice(0, indexRef.current));
      }, charDelay);
    } else if (!isStreaming && !isComplete) {
      setIsComplete(true);
      onComplete?.();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [content, displayedContent, isPaused, isStreaming, charDelay, isComplete, onComplete]);

  // Reset when content changes
  useEffect(() => {
    if (content !== displayedContent) {
      indexRef.current = 0;
      setDisplayedContent('');
      setIsComplete(false);
    }
  }, [content]);

  const handleTogglePause = useCallback(() => {
    setIsPaused((prev) => !prev);
  }, []);

  const handleSkipToEnd = useCallback(() => {
    indexRef.current = content.length;
    setDisplayedContent(content);
    setIsComplete(true);
    onComplete?.();
  }, [content, onComplete]);

  return (
    <div className={cn("relative", className)}>
      {/* Content */}
      <div
        className="prose prose-sm max-w-none dark:prose-invert"
        style={{
          color: 'var(--foreground)',
        }}
      >
        <ReactMarkdown
          components={{
            pre({ children }: any) {
              const codeChild = Array.isArray(children) ? children[0] : children;
              const className = codeChild?.props?.className || '';
              const match = /language-(\w+)/.exec(className);
              const codeString = String(codeChild?.props?.children ?? '').replace(/\n$/, '');
              return (
                <SyntaxHighlighter
                  language={match?.[1] || 'text'}
                  style={vscDarkPlus as any}
                  PreTag="div"
                >
                  {codeString}
                </SyntaxHighlighter>
              );
            },
            code({ className, children }: any) {
              return <code className={className}>{children}</code>;
            },
          }}
        >
          {displayedContent}
        </ReactMarkdown>

        {/* Blinking Cursor */}
        <AnimatePresence>
          {!isComplete && (
            <motion.span
              initial={{ opacity: 1 }}
              animate={{ opacity: [1, 0, 1] }}
              exit={{ opacity: 0 }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                ease: "easeInOut",
              }}
              className="inline-block w-0.5 h-5 ml-1 align-middle"
              style={{
                background: 'var(--primary)',
              }}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Controls */}
      {showControls && !isComplete && (
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTogglePause}
            className="h-7 px-2"
          >
            {isPaused ? (
              <>
                <Play className="h-3.5 w-3.5 mr-1.5" />
                Resume
              </>
            ) : (
              <>
                <Pause className="h-3.5 w-3.5 mr-1.5" />
                Pause
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleSkipToEnd}
            className="h-7 px-2"
          >
            <Square className="h-3.5 w-3.5 mr-1.5" />
            Skip
          </Button>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// SIMPLE STREAMING TEXT (No Markdown)
// ============================================================================

export interface StreamingTextProps {
  text: string;
  isStreaming: boolean;
  speed?: number;
  onComplete?: () => void;
  className?: string;
}

export function StreamingText({
  text,
  isStreaming,
  speed = 50,
  onComplete,
  className,
}: StreamingTextProps) {
  const [displayedText, setDisplayedText] = useState('');
  const indexRef = useRef(0);

  const charDelay = 1000 / speed;

  useEffect(() => {
    if (displayedText === text && text.length > 0) {
      onComplete?.();
      return;
    }

    if (!isStreaming && indexRef.current >= text.length) {
      return;
    }

    if (indexRef.current < text.length) {
      const timer = setTimeout(() => {
        indexRef.current += 1;
        setDisplayedText(text.slice(0, indexRef.current));
      }, charDelay);

      return () => clearTimeout(timer);
    } else if (!isStreaming) {
      onComplete?.();
    }
  }, [text, displayedText, isStreaming, charDelay, onComplete]);

  useEffect(() => {
    if (text !== displayedText) {
      indexRef.current = 0;
      setDisplayedText('');
    }
  }, [text]);

  return (
    <span className={cn("whitespace-pre-wrap", className)}>
      {displayedText}
      {isStreaming && (
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="inline-block w-0.5 h-4 ml-1 align-middle"
          style={{ background: 'var(--primary)' }}
        />
      )}
    </span>
  );
}
