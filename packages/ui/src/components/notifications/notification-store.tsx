/**
 * Notification Store — "The Stream" state management
 *
 * Every notification auto-dismisses. Severity determines how long it lingers:
 *   success → 5s, info → 7s, warning → 10s, error → 14s
 * Hover-pause is handled by the stream UI (pause/resume timers here).
 *
 * Usage:
 *   <NotificationProvider><App /></NotificationProvider>
 *   const { notify } = useNotifications();
 *   notify({ title: 'Done', severity: 'success' });
 */

import * as React from 'react';

// ── Types ────────────────────────────────────────────────────────────────────

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'error';

/** Default linger duration per severity (ms). Blink-and-gone. */
export const SEVERITY_DURATION: Record<NotificationSeverity, number> = {
  success: 1_800,
  info: 2_400,
  warning: 4_000,
  error: 6_000,
};

export interface NotificationAction {
  label: string;
  onClick: () => void;
}

export interface Notification {
  id: string;
  title: string;
  description?: string;
  severity: NotificationSeverity;
  action?: NotificationAction;
  /** ISO timestamp */
  timestamp: string;
  read: boolean;
  /** True when the toast has been dismissed from the stream (but still in history) */
  dismissed: boolean;
  /** Total linger duration (ms) — used by the progress arc */
  durationMs: number;
  /** Optional grouping key (e.g., 'pipeline', 'knowledge') */
  group?: string;
  /** Optional icon name hint for consumers */
  icon?: string;
}

export interface NotifyOptions {
  title: string;
  description?: string;
  severity?: NotificationSeverity;
  action?: NotificationAction;
  group?: string;
  icon?: string;
  /** Override auto-dismiss duration (ms). Defaults to severity-based timing. */
  durationMs?: number;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

export interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  notify: (options: NotifyOptions) => string;
  dismiss: (id: string) => void;
  dismissAll: () => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  /** Pause auto-dismiss timer (for hover) */
  pause: (id: string) => void;
  /** Resume auto-dismiss timer (for hover-out) */
  resume: (id: string) => void;
  clear: () => void;
}

// ── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: 'ADD'; notification: Notification }
  | { type: 'DISMISS'; id: string }
  | { type: 'DISMISS_ALL' }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_ALL_READ' }
  | { type: 'CLEAR' };

function reducer(state: NotificationState, action: Action): NotificationState {
  switch (action.type) {
    case 'ADD': {
      const notifications = [action.notification, ...state.notifications].slice(0, 50);
      return { notifications, unreadCount: notifications.filter(n => !n.read).length };
    }
    case 'DISMISS': {
      const notifications = state.notifications.map(n =>
        n.id === action.id ? { ...n, dismissed: true, read: true } : n,
      );
      return { notifications, unreadCount: notifications.filter(n => !n.read).length };
    }
    case 'DISMISS_ALL': {
      const notifications = state.notifications.map(n => ({ ...n, dismissed: true, read: true }));
      return { notifications, unreadCount: 0 };
    }
    case 'MARK_READ': {
      const notifications = state.notifications.map(n =>
        n.id === action.id ? { ...n, read: true } : n,
      );
      return { notifications, unreadCount: notifications.filter(n => !n.read).length };
    }
    case 'MARK_ALL_READ': {
      const notifications = state.notifications.map(n => ({ ...n, read: true }));
      return { notifications, unreadCount: 0 };
    }
    case 'CLEAR':
      return { notifications: [], unreadCount: 0 };
    default:
      return state;
  }
}

// ── Context ──────────────────────────────────────────────────────────────────

const NotificationContext = React.createContext<NotificationContextValue | null>(null);

let _idCounter = 0;
function generateId(): string {
  return `notif-${Date.now()}-${++_idCounter}`;
}

// ── Provider ─────────────────────────────────────────────────────────────────

export interface NotificationProviderProps {
  children: React.ReactNode;
  /** Max notifications to keep in memory (default: 50) */
  maxNotifications?: number;
}

export function NotificationProvider({ children, maxNotifications: _max }: NotificationProviderProps) {
  const [state, dispatch] = React.useReducer(reducer, { notifications: [], unreadCount: 0 });
  const timersRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Clean up timers on unmount
  React.useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach(t => clearTimeout(t));
      timers.clear();
    };
  }, []);

  // Track remaining time for pause/resume
  const remainingRef = React.useRef<Map<string, { remaining: number; startedAt: number }>>(new Map());

  const startTimer = React.useCallback((id: string, ms: number) => {
    remainingRef.current.set(id, { remaining: ms, startedAt: Date.now() });
    const timer = setTimeout(() => {
      dispatch({ type: 'DISMISS', id });
      timersRef.current.delete(id);
      remainingRef.current.delete(id);
    }, ms);
    timersRef.current.set(id, timer);
  }, []);

  const notify = React.useCallback((options: NotifyOptions): string => {
    const id = generateId();
    const severity = options.severity ?? 'info';
    const durationMs = options.durationMs ?? SEVERITY_DURATION[severity];
    const notification: Notification = {
      id,
      title: options.title,
      severity,
      timestamp: new Date().toISOString(),
      read: false,
      dismissed: false,
      durationMs,
      ...(options.description != null && { description: options.description }),
      ...(options.action != null && { action: options.action }),
      ...(options.group != null && { group: options.group }),
      ...(options.icon != null && { icon: options.icon }),
    };
    dispatch({ type: 'ADD', notification });
    startTimer(id, durationMs);
    return id;
  }, [startTimer]);

  const dismiss = React.useCallback((id: string) => {
    dispatch({ type: 'DISMISS', id });
    const timer = timersRef.current.get(id);
    if (timer) { clearTimeout(timer); timersRef.current.delete(id); }
  }, []);

  const dismissAll = React.useCallback(() => {
    dispatch({ type: 'DISMISS_ALL' });
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
  }, []);

  const markRead = React.useCallback((id: string) => dispatch({ type: 'MARK_READ', id }), []);
  const markAllRead = React.useCallback(() => dispatch({ type: 'MARK_ALL_READ' }), []);

  const pause = React.useCallback((id: string) => {
    const timer = timersRef.current.get(id);
    const meta = remainingRef.current.get(id);
    if (timer && meta) {
      clearTimeout(timer);
      timersRef.current.delete(id);
      const elapsed = Date.now() - meta.startedAt;
      remainingRef.current.set(id, { remaining: Math.max(meta.remaining - elapsed, 1_000), startedAt: 0 });
    }
  }, []);

  const resume = React.useCallback((id: string) => {
    const meta = remainingRef.current.get(id);
    if (meta && meta.startedAt === 0) {
      startTimer(id, meta.remaining);
    }
  }, [startTimer]);

  const clear = React.useCallback(() => {
    dispatch({ type: 'CLEAR' });
    timersRef.current.forEach(t => clearTimeout(t));
    timersRef.current.clear();
    remainingRef.current.clear();
  }, []);

  const value = React.useMemo<NotificationContextValue>(() => ({
    notifications: state.notifications,
    unreadCount: state.unreadCount,
    notify,
    dismiss,
    dismissAll,
    markRead,
    markAllRead,
    pause,
    resume,
    clear,
  }), [state.notifications, state.unreadCount, notify, dismiss, dismissAll, markRead, markAllRead, pause, resume, clear]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useNotifications(): NotificationContextValue {
  const ctx = React.useContext(NotificationContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within <NotificationProvider>');
  }
  return ctx;
}
