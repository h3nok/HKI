/**
 * useLocalStorage — Persist state to localStorage with SSR safety.
 *
 * Drop-in replacement for useState that syncs to localStorage.
 * Falls back to in-memory state if localStorage is unavailable.
 */

import { useState, useCallback, useEffect } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  // Initialize from localStorage (or fallback)
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? (JSON.parse(item) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  // Persist to localStorage on change
  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStoredValue((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        try {
          window.localStorage.setItem(key, JSON.stringify(next));
        } catch {
          // Quota exceeded or private browsing — silently degrade
        }
        return next;
      });
    },
    [key],
  );

  return [storedValue, setValue] as const;
}
