'use client';

import { useState, useEffect, useRef } from 'react';

/**
 * Hook for handling streaming text with cursor animation
 */
export function useStreamingText(
  content: string,
  isStreaming: boolean
) {
  const [displayedContent, setDisplayedContent] = useState(content);
  const [showCursor, setShowCursor] = useState(false);
  const lastContentRef = useRef(content);

  useEffect(() => {
    // Only update if content actually changed
    if (content !== lastContentRef.current) {
      setDisplayedContent(content);
      lastContentRef.current = content;
    }
  }, [content]);

  useEffect(() => {
    setShowCursor(isStreaming);
  }, [isStreaming]);

  // Cursor blink effect
  useEffect(() => {
    if (!isStreaming) {
      setShowCursor(false);
      return;
    }

    const interval = setInterval(() => {
      setShowCursor(prev => !prev);
    }, 530);

    return () => clearInterval(interval);
  }, [isStreaming]);

  return {
    displayedContent,
    showCursor: isStreaming && showCursor,
    cursorElement: isStreaming ? (
      <span 
        className="inline-block w-0.5 h-4 bg-current animate-pulse ml-0.5" 
        aria-hidden="true"
      />
    ) : null,
  };
}
