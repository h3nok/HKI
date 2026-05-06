/**
 * Local Storage State Hook
 * Persists state in localStorage with SSR support
 */

import { useState, useEffect, useCallback } from 'react';

export function useLocalStorageState<T>(
  key: string,
  defaultValue: T
): [T, (value: T | ((prev: T) => T)) => void] {
  // Initialize with default value for SSR
  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) {
        setState(JSON.parse(stored) as T);
      }
    } catch {
      // Ignore parse errors
    }
    setIsHydrated(true);
  }, [key]);

  // Persist to localStorage on change
  const setStoredState = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const nextValue = typeof value === 'function' 
          ? (value as (prev: T) => T)(prev) 
          : value;
        
        try {
          localStorage.setItem(key, JSON.stringify(nextValue));
        } catch {
          // Ignore storage errors
        }
        
        return nextValue;
      });
    },
    [key]
  );

  return [state, setStoredState];
}
