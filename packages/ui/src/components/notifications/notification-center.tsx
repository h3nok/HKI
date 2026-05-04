/**
 * NotificationCenter — Immersive detail viewer
 *
 * A glassmorphic popover command-center for notification history.
 * Features:
 *   - Ambient PulseIndicator trigger (replaces bell icon)
 *   - Severity filter chips with animated selection
 *   - Timeline-grouped history (Just now, Earlier, Yesterday)
 *   - Expandable detail cards with full metadata
 *   - Smooth framer-motion list animations
 *
 * Uses Radix Popover. Must be inside <NotificationProvider>.
 */

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../utils";
import { useTheme } from "../../providers/theme-provider";
import {
  useNotifications,
  type Notification,
  type NotificationSeverity,
} from "./notification-store";

// ── Time helpers ─────────────────────────────────────────────────────────

type TimeBucket = "now" | "earlier" | "yesterday" | "older";

function getBucket(iso: string): TimeBucket {
  const mins = (Date.now() - new Date(iso).getTime()) / 60_000;
  if (mins < 5) return "now";
  if (mins < 720) return "earlier";
  if (mins < 2160) return "yesterday";
  return "older";
}

const BUCKET_LABEL: Record<TimeBucket, string> = {
  now: "Just now",
  earlier: "Earlier",
  yesterday: "Yesterday",
  older: "Older",
};

function useNotificationThemeVars() {
  const { resolvedTheme } = useTheme();

  return React.useMemo(() => {
    // Hardcoded values matched to the agentic theme (agentic.css + semantic.css).
    // We don't read from getPropertyValue because it returns raw var() references
    // like "var(--color-neutral-850)" which aren't reliable as inline style values
    // when the portal renders outside the component tree.
    return resolvedTheme === "dark"
      ? {
          card: "#18181b",
          cardForeground: "#f4f4f5",
          border: "#3f3f46",
          muted: "#27272a",
          mutedForeground: "#a1a1aa",
          foreground: "#f4f4f5",
        }
      : {
          card: "#ffffff",
          cardForeground: "#0f172a",
          border: "#8e96a8",
          muted: "#c9cfdd",
          mutedForeground: "#334155",
          foreground: "#0f172a",
        };
  }, [resolvedTheme]);
}

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 10) return "just now";
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Severity styles ──────────────────────────────────────────────────────

const SEV: Record<
  NotificationSeverity,
  {
    dot: string;
    bg: string;
    border: string;
    text: string;
    label: string;
  }
> = {
  success: {
    dot: "bg-emerald-500",
    bg: "bg-emerald-500/6 dark:bg-emerald-500/12",
    border: "border-emerald-500/15 dark:border-emerald-500/25",
    text: "text-emerald-600 dark:text-emerald-400",
    label: "Success",
  },
  info: {
    dot: "bg-blue-500",
    bg: "bg-blue-500/6 dark:bg-blue-500/12",
    border: "border-blue-500/15 dark:border-blue-500/25",
    text: "text-blue-600 dark:text-blue-400",
    label: "Info",
  },
  warning: {
    dot: "bg-amber-500",
    bg: "bg-amber-500/6 dark:bg-amber-500/12",
    border: "border-amber-500/15 dark:border-amber-500/25",
    text: "text-amber-600 dark:text-amber-400",
    label: "Warning",
  },
  error: {
    dot: "bg-red-500",
    bg: "bg-red-500/6 dark:bg-red-500/12",
    border: "border-red-500/15 dark:border-red-500/25",
    text: "text-red-600 dark:text-red-400",
    label: "Error",
  },
};

const SEV_ORDER: NotificationSeverity[] = [
  "error",
  "warning",
  "info",
  "success",
];

// ── Inline SVG icons ─────────────────────────────────────────────────────

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function CheckAllIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 7 17l-5-5" />
      <path d="m22 10-9.17 9.17L11 17.34" />
    </svg>
  );
}

function Trash2Icon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
    </svg>
  );
}

function XIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function InboxIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

function SevIcon({
  severity,
  className,
}: {
  severity: NotificationSeverity;
  className?: string;
}) {
  const p = {
    xmlns: "http://www.w3.org/2000/svg",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className,
  };
  switch (severity) {
    case "success":
      return (
        <svg {...p}>
          <path d="M20 6 9 17l-5-5" />
        </svg>
      );
    case "error":
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v4" />
          <path d="M12 16h.01" />
        </svg>
      );
    case "warning":
      return (
        <svg {...p}>
          <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
      );
    default:
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      );
  }
}

// ── Pulse Indicator (ambient bell trigger) ───────────────────────────────

function PulseIndicator({
  unreadCount,
  className,
}: {
  unreadCount: number;
  className?: string;
}) {
  const active = unreadCount > 0;
  return (
    <div
      className={cn(
        "relative w-7 h-7 flex items-center justify-center",
        className,
      )}
    >
      {active && (
        <motion.div
          className="absolute inset-0 rounded-lg"
          animate={{
            boxShadow: [
              "0 0 0 0 rgba(59,130,246,0)",
              "0 0 0 3px rgba(59,130,246,0.15)",
              "0 0 0 0 rgba(59,130,246,0)",
            ],
          }}
          transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
      <BellIcon
        className={cn(
          "w-3.5 h-3.5",
          active ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground",
        )}
      />
      {active && (
        <motion.span
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 20 }}
          className="absolute -top-1 -right-1 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold leading-none ring-2 ring-background"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </motion.span>
      )}
    </div>
  );
}

// ── Detail Item ──────────────────────────────────────────────────────────

function DetailItem({
  notification: n,
  onDismiss,
  onMarkRead,
  expanded,
  onToggle,
}: {
  notification: Notification;
  onDismiss: (id: string) => void;
  onMarkRead: (id: string) => void;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sev = SEV[n.severity];

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "relative group rounded-xl transition-colors",
        n.read ? "opacity-55 hover:opacity-75" : "",
        expanded ? cn(sev.bg, "border", sev.border) : "hover:bg-muted/50",
      )}
    >
      <button
        onClick={onToggle}
        className="w-full text-left px-3 py-2.5 flex items-start gap-3"
      >
        {/* Severity dot + breathing indicator */}
        <div className="flex flex-col items-center pt-1 shrink-0 gap-1">
          <div
            className={cn(
              "w-2 h-2 rounded-full transition-all",
              sev.dot,
              n.read && "opacity-30",
            )}
          />
          {!n.read && (
            <motion.div
              className={cn("w-1 h-1 rounded-full", sev.dot)}
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p
              className={cn(
                "text-[13px] leading-snug truncate",
                n.read
                  ? "text-muted-foreground"
                  : "font-semibold text-foreground",
              )}
            >
              {n.title}
            </p>
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-[10px] tabular-nums text-muted-foreground pt-0.5">
                {timeAgo(n.timestamp)}
              </span>
              <motion.div
                animate={{ rotate: expanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <ChevronIcon className="w-3 h-3 text-muted-foreground/70" />
              </motion.div>
            </div>
          </div>
          {!expanded && n.description && (
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {n.description}
            </p>
          )}
        </div>
      </button>

      {/* Expanded detail panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-3 pl-8 space-y-2">
              {n.description && (
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {n.description}
                </p>
              )}
              {/* Meta pills */}
              <div className="flex items-center flex-wrap gap-1.5">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold",
                    sev.bg,
                    sev.text,
                  )}
                >
                  <SevIcon severity={n.severity} className="w-2.5 h-2.5" />
                  {sev.label}
                </span>
                {n.group && (
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-muted text-muted-foreground uppercase tracking-wider">
                    {n.group}
                  </span>
                )}
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {new Date(n.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </div>
              {/* Actions */}
              <div className="flex items-center gap-2 pt-1">
                {n.action && (
                  <button
                    onClick={() => {
                      n.action?.onClick?.();
                      onMarkRead(n.id);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-bold bg-foreground text-background hover:opacity-90 active:scale-[0.97] transition-all"
                  >
                    {n.action.label}
                  </button>
                )}
                {!n.read && (
                  <button
                    onClick={() => onMarkRead(n.id)}
                    className="text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mark read
                  </button>
                )}
                <button
                  onClick={() => onDismiss(n.id)}
                  className="text-[11px] font-medium text-muted-foreground hover:text-red-500 transition-colors ml-auto"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hover dismiss X */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDismiss(n.id);
        }}
        className="absolute top-2.5 right-8 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-muted transition-all"
        title="Dismiss"
      >
        <XIcon className="w-3 h-3 text-muted-foreground" />
      </button>
    </motion.div>
  );
}

// ── NotificationCenter ───────────────────────────────────────────────────

export interface NotificationCenterProps {
  className?: string;
  trigger?: React.ReactNode;
  align?: "start" | "center" | "end";
  sideOffset?: number;
}

export function NotificationCenter({
  className,
  trigger,
  align = "end",
  sideOffset = 8,
}: NotificationCenterProps) {
  const { resolvedTheme } = useTheme();
  const themeVars = useNotificationThemeVars();
  const {
    notifications,
    unreadCount,
    dismiss,
    dismissAll,
    markRead,
    markAllRead,
  } = useNotifications();
  const [open, setOpen] = React.useState(false);
  const [filter, setFilter] = React.useState<NotificationSeverity | null>(null);
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  const filtered = filter
    ? notifications.filter((n) => n.severity === filter)
    : notifications;

  const grouped = React.useMemo(() => {
    const b: Record<TimeBucket, Notification[]> = {
      now: [],
      earlier: [],
      yesterday: [],
      older: [],
    };
    for (const n of filtered) b[getBucket(n.timestamp)].push(n);
    return b;
  }, [filtered]);

  const counts = React.useMemo(() => {
    const c: Record<NotificationSeverity, number> = {
      success: 0,
      info: 0,
      warning: 0,
      error: 0,
    };
    for (const n of notifications) c[n.severity]++;
    return c;
  }, [notifications]);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        {trigger || (
          <button
            className={cn(
              "relative inline-flex items-center justify-center w-7 h-7 rounded-lg hover:bg-muted transition-colors",
              className,
            )}
            aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
          >
            <PulseIndicator unreadCount={unreadCount} />
          </button>
        )}
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={sideOffset}
          style={{
            backgroundColor: themeVars.card,
            color: themeVars.cardForeground,
            borderColor: themeVars.border,
          }}
          data-theme={resolvedTheme}
          className={cn(
            "z-50 w-[400px] min-w-[400px] max-w-[400px] max-h-[520px] rounded-2xl overflow-hidden",
            "border",
            resolvedTheme === "dark"
              ? "shadow-[0_8px_32px_rgba(0,0,0,0.5)]"
              : "shadow-[0_8px_32px_rgba(0,0,0,0.16)]",
            "animate-in fade-in-0 zoom-in-[0.97] slide-in-from-top-2 duration-200",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-[0.97] data-[state=closed]:duration-150",
          )}
        >
          {/* Header */}
          <div
            className="px-4 pt-4 pb-3 border-b border-border"
            style={{ borderColor: themeVars.border }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <h3
                  className="text-sm font-bold text-foreground"
                  style={{ color: themeVars.foreground }}
                >
                  Notifications
                </h3>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary tabular-nums">
                    {unreadCount} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    title="Mark all read"
                  >
                    <CheckAllIcon className="w-3.5 h-3.5" />
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={dismissAll}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/8 transition-colors"
                    title="Clear all"
                  >
                    <Trash2Icon className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
            {/* Severity filter chips */}
            {notifications.length > 0 && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setFilter(null)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                    filter === null
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  All
                </button>
                {SEV_ORDER.map(
                  (s) =>
                    counts[s] > 0 && (
                      <button
                        key={s}
                        onClick={() => setFilter(filter === s ? null : s)}
                        className={cn(
                          "inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all",
                          filter === s
                            ? cn(
                                SEV[s].bg,
                                SEV[s].text,
                                "border",
                                SEV[s].border,
                              )
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        <div
                          className={cn("w-1.5 h-1.5 rounded-full", SEV[s].dot)}
                        />
                        {counts[s]}
                      </button>
                    ),
                )}
              </div>
            )}
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto max-h-[400px] p-2">
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut",
                  }}
                >
                  <InboxIcon className="w-8 h-8 text-muted-foreground/50" />
                </motion.div>
                <p
                  className="text-sm font-medium text-muted-foreground mt-3"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {filter ? "No matching notifications" : "All clear"}
                </p>
                <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                  {filter ? "Try a different filter" : "You're all caught up"}
                </p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {(
                  Object.entries(grouped) as [TimeBucket, Notification[]][]
                ).map(
                  ([bucket, items]) =>
                    items.length > 0 && (
                      <div key={bucket} className="mb-1">
                        <p className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70">
                          {BUCKET_LABEL[bucket]}
                        </p>
                        {items.map((notif) => (
                          <DetailItem
                            key={notif.id}
                            notification={notif}
                            onDismiss={dismiss}
                            onMarkRead={markRead}
                            expanded={expandedId === notif.id}
                            onToggle={() =>
                              setExpandedId(
                                expandedId === notif.id ? null : notif.id,
                              )
                            }
                          />
                        ))}
                      </div>
                    ),
                )}
              </AnimatePresence>
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
