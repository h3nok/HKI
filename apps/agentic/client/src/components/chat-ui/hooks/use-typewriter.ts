import { useState, useEffect, useRef } from 'react';

/**
 * useTypewriter — Performant typewriter animation
 *
 * Uses requestAnimationFrame with batched character reveals
 * to avoid 1000+ re-renders on long responses.
 * Renders ~4 characters per frame at 60fps (~240 chars/sec).
 */
export function useTypewriter(text: string, speed: number = 30, enabled: boolean = true) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const prevTextRef = useRef(text);

  useEffect(() => {
    if (!enabled) {
      setDisplayedText(text);
      setIsTyping(false);
      return;
    }

    // If text is appending (streaming), continue from where we left off
    const isAppend = text.startsWith(prevTextRef.current) && prevTextRef.current.length > 0;
    const startIndex = isAppend ? prevTextRef.current.length : 0;
    prevTextRef.current = text;

    if (startIndex === 0) {
      setDisplayedText('');
    }
    setIsTyping(true);

    let currentIndex = startIndex;
    let lastTime = 0;
    let rafId: number;

    // Batch: reveal multiple chars per frame based on speed
    const charsPerFrame = Math.max(1, Math.round(16 / speed)); // ~16ms per frame

    const tick = (time: number) => {
      if (!lastTime) lastTime = time;
      const elapsed = time - lastTime;

      if (elapsed >= speed) {
        const charsToAdd = Math.min(
          charsPerFrame * Math.floor(elapsed / speed),
          text.length - currentIndex,
        );
        currentIndex += charsToAdd;
        setDisplayedText(text.slice(0, currentIndex));
        lastTime = time;
      }

      if (currentIndex < text.length) {
        rafId = requestAnimationFrame(tick);
      } else {
        setIsTyping(false);
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [text, speed, enabled]);

  return { displayedText, isTyping };
}
