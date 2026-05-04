"use client";

import * as React from "react";

type TimeoutHandle = ReturnType<typeof setTimeout>;
type IntervalHandle = ReturnType<typeof setInterval>;

// ============================================================================
// useRetry Hook
// ============================================================================

export interface UseRetryOptions<T> {
  /** Maximum number of retry attempts */
  maxRetries?: number;
  /** Base delay between retries in ms */
  baseDelay?: number;
  /** Use exponential backoff */
  exponentialBackoff?: boolean;
  /** Maximum delay cap in ms */
  maxDelay?: number;
  /** Callback on each retry attempt */
  onRetry?: (attempt: number, error: Error) => void;
  /** Callback on final failure */
  onFailure?: (error: Error, attempts: number) => void;
  /** Callback on success */
  onSuccess?: (result: T, attempts: number) => void;
  /** Condition to determine if error is retryable */
  retryCondition?: (error: Error) => boolean;
}

export interface UseRetryReturn<T> {
  /** Execute the async function with retry logic */
  execute: () => Promise<T | undefined>;
  /** Current attempt number (0 = not started) */
  attempt: number;
  /** Whether currently executing */
  isLoading: boolean;
  /** Whether currently in retry delay */
  isRetrying: boolean;
  /** Last error encountered */
  error: Error | null;
  /** Successful result */
  data: T | null;
  /** Reset state */
  reset: () => void;
  /** Cancel ongoing retries */
  cancel: () => void;
}

export function useRetry<T>(
  asyncFn: () => Promise<T>,
  options: UseRetryOptions<T> = {}
): UseRetryReturn<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    exponentialBackoff = true,
    maxDelay = 30000,
    onRetry,
    onFailure,
    onSuccess,
    retryCondition = () => true,
  } = options;

  const [attempt, setAttempt] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isRetrying, setIsRetrying] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<T | null>(null);

  const cancelledRef = React.useRef(false);
  const timeoutRef = React.useRef<TimeoutHandle | null>(null);

  const getDelay = React.useCallback(
    (attemptNum: number): number => {
      const delay = exponentialBackoff
        ? baseDelay * Math.pow(2, attemptNum - 1)
        : baseDelay;
      return Math.min(delay, maxDelay);
    },
    [baseDelay, exponentialBackoff, maxDelay]
  );

  const execute = React.useCallback(async (): Promise<T | undefined> => {
    cancelledRef.current = false;
    setIsLoading(true);
    setError(null);
    setData(null);

    let currentAttempt = 0;
    let lastError: Error | null = null;

    while (currentAttempt <= maxRetries && !cancelledRef.current) {
      currentAttempt++;
      setAttempt(currentAttempt);

      try {
        const result = await asyncFn();
        if (!cancelledRef.current) {
          setData(result);
          setIsLoading(false);
          setIsRetrying(false);
          onSuccess?.(result, currentAttempt);
          return result;
        }
        return undefined;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));

        if (cancelledRef.current) {
          return undefined;
        }

        const canRetry =
          currentAttempt < maxRetries && retryCondition(lastError);

        if (canRetry) {
          onRetry?.(currentAttempt, lastError);
          setIsRetrying(true);
          const delay = getDelay(currentAttempt);

          await new Promise<void>((resolve) => {
            timeoutRef.current = setTimeout(resolve, delay);
          });

          if (cancelledRef.current) {
            return undefined;
          }
          setIsRetrying(false);
        } else {
          setError(lastError);
          setIsLoading(false);
          setIsRetrying(false);
          onFailure?.(lastError, currentAttempt);
          return undefined;
        }
      }
    }

    return undefined;
  }, [asyncFn, maxRetries, retryCondition, getDelay, onRetry, onSuccess, onFailure]);

  const reset = React.useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setAttempt(0);
    setIsLoading(false);
    setIsRetrying(false);
    setError(null);
    setData(null);
  }, []);

  const cancel = React.useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsLoading(false);
    setIsRetrying(false);
  }, []);

  React.useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    execute,
    attempt,
    isLoading,
    isRetrying,
    error,
    data,
    reset,
    cancel,
  };
}

// ============================================================================
// useTimeout Hook
// ============================================================================

export interface UseTimeoutOptions {
  /** Timeout duration in ms */
  timeout: number;
  /** Callback when timeout occurs */
  onTimeout?: () => void;
}

export interface UseTimeoutReturn<T> {
  /** Execute the async function with timeout */
  execute: () => Promise<T | undefined>;
  /** Whether currently executing */
  isLoading: boolean;
  /** Whether timed out */
  isTimedOut: boolean;
  /** Error (including timeout error) */
  error: Error | null;
  /** Successful result */
  data: T | null;
  /** Time remaining in ms (if tracking) */
  timeRemaining: number | null;
  /** Reset state */
  reset: () => void;
  /** Cancel execution */
  cancel: () => void;
}

export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export function useTimeout<T>(
  asyncFn: () => Promise<T>,
  options: UseTimeoutOptions
): UseTimeoutReturn<T> {
  const { timeout, onTimeout } = options;

  const [isLoading, setIsLoading] = React.useState(false);
  const [isTimedOut, setIsTimedOut] = React.useState(false);
  const [error, setError] = React.useState<Error | null>(null);
  const [data, setData] = React.useState<T | null>(null);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);

  const cancelledRef = React.useRef(false);
  const timeoutRef = React.useRef<TimeoutHandle | null>(null);
  const intervalRef = React.useRef<IntervalHandle | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  const execute = React.useCallback(async (): Promise<T | undefined> => {
    cancelledRef.current = false;
    setIsLoading(true);
    setIsTimedOut(false);
    setError(null);
    setData(null);
    startTimeRef.current = Date.now();
    setTimeRemaining(timeout);

    // Start countdown interval
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, timeout - elapsed);
        setTimeRemaining(remaining);
      }
    }, 100);

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutRef.current = setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${timeout}ms`));
      }, timeout);
    });

    try {
      const result = await Promise.race([asyncFn(), timeoutPromise]);

      if (!cancelledRef.current) {
        setData(result);
        setIsLoading(false);
        setTimeRemaining(null);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (intervalRef.current) clearInterval(intervalRef.current);
        return result;
      }
      return undefined;
    } catch (err) {
      if (cancelledRef.current) {
        return undefined;
      }

      const error = err instanceof Error ? err : new Error(String(err));
      const timedOut = error instanceof TimeoutError;

      setError(error);
      setIsTimedOut(timedOut);
      setIsLoading(false);
      setTimeRemaining(null);

      if (timedOut) {
        onTimeout?.();
      }

      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);

      return undefined;
    }
  }, [asyncFn, timeout, onTimeout]);

  const reset = React.useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsLoading(false);
    setIsTimedOut(false);
    setError(null);
    setData(null);
    setTimeRemaining(null);
  }, []);

  const cancel = React.useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsLoading(false);
    setTimeRemaining(null);
  }, []);

  React.useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    execute,
    isLoading,
    isTimedOut,
    error,
    data,
    timeRemaining,
    reset,
    cancel,
  };
}

// ============================================================================
// useAsyncOperation - Combined retry + timeout
// ============================================================================

export interface UseAsyncOperationOptions<T>
  extends UseRetryOptions<T>,
    UseTimeoutOptions {}

export interface UseAsyncOperationReturn<T> {
  execute: () => Promise<T | undefined>;
  isLoading: boolean;
  isRetrying: boolean;
  isTimedOut: boolean;
  attempt: number;
  error: Error | null;
  data: T | null;
  timeRemaining: number | null;
  reset: () => void;
  cancel: () => void;
}

export function useAsyncOperation<T>(
  asyncFn: () => Promise<T>,
  options: UseAsyncOperationOptions<T>
): UseAsyncOperationReturn<T> {
  const { timeout, onTimeout, ...retryOptions } = options;

  const [isTimedOut, setIsTimedOut] = React.useState(false);
  const [timeRemaining, setTimeRemaining] = React.useState<number | null>(null);

  const cancelledRef = React.useRef(false);
  const globalTimeoutRef = React.useRef<TimeoutHandle | null>(null);
  const intervalRef = React.useRef<IntervalHandle | null>(null);
  const startTimeRef = React.useRef<number | null>(null);

  const wrappedAsyncFn = React.useCallback(async (): Promise<T> => {
    if (cancelledRef.current) {
      throw new Error("Operation cancelled");
    }
    return asyncFn();
  }, [asyncFn]);

  const retry = useRetry(wrappedAsyncFn, {
    ...retryOptions,
    onFailure: (error, attempts) => {
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      retryOptions.onFailure?.(error, attempts);
    },
    onSuccess: (result, attempts) => {
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
      setTimeRemaining(null);
      retryOptions.onSuccess?.(result, attempts);
    },
  });

  const execute = React.useCallback(async (): Promise<T | undefined> => {
    cancelledRef.current = false;
    setIsTimedOut(false);
    startTimeRef.current = Date.now();
    setTimeRemaining(timeout);

    // Start global timeout
    globalTimeoutRef.current = setTimeout(() => {
      cancelledRef.current = true;
      retry.cancel();
      setIsTimedOut(true);
      onTimeout?.();
    }, timeout);

    // Start countdown
    intervalRef.current = setInterval(() => {
      if (startTimeRef.current) {
        const elapsed = Date.now() - startTimeRef.current;
        const remaining = Math.max(0, timeout - elapsed);
        setTimeRemaining(remaining);
      }
    }, 100);

    return retry.execute();
  }, [timeout, onTimeout, retry]);

  const reset = React.useCallback(() => {
    cancelledRef.current = true;
    if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    retry.reset();
    setIsTimedOut(false);
    setTimeRemaining(null);
  }, [retry]);

  const cancel = React.useCallback(() => {
    cancelledRef.current = true;
    if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    retry.cancel();
    setTimeRemaining(null);
  }, [retry]);

  React.useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (globalTimeoutRef.current) clearTimeout(globalTimeoutRef.current);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return {
    execute,
    isLoading: retry.isLoading,
    isRetrying: retry.isRetrying,
    isTimedOut,
    attempt: retry.attempt,
    error: retry.error,
    data: retry.data,
    timeRemaining,
    reset,
    cancel,
  };
}
