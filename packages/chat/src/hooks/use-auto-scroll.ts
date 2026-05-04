'use client';

import { useRef, useEffect, useCallback, useState } from 'react';

export interface UseAutoScrollOptions {
  /** Threshold in pixels from bottom to trigger auto-scroll */
  threshold?: number;
  /** Smooth scroll behavior */
  smooth?: boolean;
}

export function useAutoScroll<T extends HTMLElement>(
  dependencies: unknown[],
  options: UseAutoScrollOptions = {}
) {
  const { threshold = 100, smooth = true } = options;
  
  const containerRef = useRef<T>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Check if user is near bottom
  const checkScrollPosition = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const atBottom = distanceFromBottom <= threshold;
    
    setIsAtBottom(atBottom);
    setShowScrollButton(!atBottom && scrollHeight > clientHeight);
  }, [threshold]);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (smooth) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      bottomRef.current?.scrollIntoView();
    }
  }, [smooth]);

  // Auto-scroll when dependencies change (if at bottom)
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);

  // Set up scroll listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('scroll', checkScrollPosition);
    checkScrollPosition(); // Initial check

    return () => {
      container.removeEventListener('scroll', checkScrollPosition);
    };
  }, [checkScrollPosition]);

  return {
    containerRef,
    bottomRef,
    isAtBottom,
    showScrollButton,
    scrollToBottom,
  };
}
