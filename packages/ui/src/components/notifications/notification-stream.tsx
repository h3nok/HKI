/**
 * NotificationStream — Organic floating overlay
 *
 * Industry-grade features:
 *   - Spring-physics entrance via framer-motion
 *   - Drag-to-dismiss with velocity detection
 *   - Progress arc with urgency-intensifying glow
 *   - Breathing ambient halo (cards feel alive)
 *   - Perspective stack depth for queued cards
 *   - Group badges + live relative timestamps
 *   - Keyboard: Escape dismisses topmost card
 *
 * Renders via portal — always above everything.
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import { cn } from "../../utils";
import { useTheme } from "../../providers/theme-provider";
import {
  useNotifications,
  type Notification,
  type NotificationSeverity,
} from "./notification-store";

// ── Severity palette ─────────────────────────────────────────────────────

const PAL: Record<
  NotificationSeverity,
  {
    stroke: string;
    bar: string;
    iconBg: string;
    text: string;
  }
> = {
  success: {
    stroke: "#22c55e",
    bar: "bg-emerald-500",
    iconBg: "bg-emerald-500/12",
    text: "text-emerald-600 dark:text-emerald-400",
  },
  info: {
    stroke: "#3b82f6",
    bar: "bg-blue-500",
    iconBg: "bg-blue-500/12",
    text: "text-blue-600 dark:text-blue-400",
  },
  warning: {
    stroke: "#f59e0b",
    bar: "bg-amber-500",
    iconBg: "bg-amber-500/12",
    text: "text-amber-600 dark:text-amber-400",
  },
  error: {
    stroke: "#ef4444",
    bar: "bg-red-500",
    iconBg: "bg-red-500/12",
    text: "text-red-600 dark:text-red-400",
  },
};

// ── Spring presets ───────────────────────────────────────────────────────

const SPRING_IN = {
  type: "spring" as const,
  stiffness: 500,
  damping: 32,
  mass: 0.6,
};

// ── Progress Arc ─────────────────────────────────────────────────────────

const ARC_R = 11;
const ARC_CX = 14;
const ARC_C = 2 * Math.PI * ARC_R;

function ProgressArc({
  durationMs,
  paused,
  severity,
}: {
  durationMs: number;
  paused: boolean;
  severity: NotificationSeverity;
}) {
  const [progress, setProgress] = React.useState(1);
  const startRef = React.useRef(Date.now());
  const elapsedRef = React.useRef(0);
  const pauseRef = React.useRef(0);

  React.useEffect(() => {
    if (paused) {
      pauseRef.current = Date.now();
      return;
    }
    if (pauseRef.current > 0) {
      elapsedRef.current += pauseRef.current - startRef.current;
      startRef.current = Date.now();
      pauseRef.current = 0;
    }
    let raf: number;
    const tick = () => {
      const t = elapsedRef.current + (Date.now() - startRef.current);
      const p = Math.max(0, 1 - t / durationMs);
      setProgress(p);
      if (p > 0) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [paused, durationMs]);

  const offset = ARC_C * (1 - progress);
  const col = PAL[severity].stroke;
  const urgency = 0.35 + (1 - progress) * 0.55;

  return (
    <svg width={28} height={28} className="shrink-0 -rotate-90">
      <defs>
        <filter
          id={`ag-${severity}`}
          x="-50%"
          y="-50%"
          width="200%"
          height="200%"
        >
          <feGaussianBlur stdDeviation="2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <circle
        cx={ARC_CX}
        cy={ARC_CX}
        r={ARC_R}
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        className="text-border"
      />
      <circle
        cx={ARC_CX}
        cy={ARC_CX}
        r={ARC_R}
        fill="none"
        stroke={col}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeDasharray={ARC_C}
        strokeDashoffset={offset}
        opacity={urgency + 0.35}
        filter={progress < 0.25 ? `url(#ag-${severity})` : undefined}
        style={{ transition: paused ? "stroke-dashoffset 0.3s ease" : "none" }}
      />
    </svg>
  );
}

// ── Inline SVG icons ─────────────────────────────────────────────────────

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

function XSvg({ className }: { className?: string }) {
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

function useNotificationThemeVars() {
  const { resolvedTheme } = useTheme();

  return React.useMemo(() => {
    const fallback =
      resolvedTheme === "dark"
        ? {
            card: "#18181b",
            cardForeground: "#f4f4f5",
            border: "#3f3f46",
            muted: "rgba(255,255,255,0.06)",
            mutedForeground: "#a1a1aa",
            foreground: "#f4f4f5",
            background: "#000000",
          }
        : {
            card: "#ffffff",
            cardForeground: "#0f172a",
            border: "#cbd5e1",
            muted: "#f1f5f9",
            mutedForeground: "#64748b",
            foreground: "#0f172a",
            background: "#f8fafc",
          };

    if (typeof window === "undefined") return fallback;

    const root = getComputedStyle(document.documentElement);
    const read = (name: string, fallbackValue: string) =>
      root.getPropertyValue(name).trim() || fallbackValue;

    return {
      card: read("--card", fallback.card),
      cardForeground: read("--card-foreground", fallback.cardForeground),
      border: read("--border", fallback.border),
      muted: read("--muted", fallback.muted),
      mutedForeground: read("--muted-foreground", fallback.mutedForeground),
      foreground: read("--foreground", fallback.foreground),
      background: read("--background", fallback.background),
    };
  }, [resolvedTheme]);
}

// ── Live relative timestamp ──────────────────────────────────────────────

function useRelativeTime(iso: string) {
  const fmt = React.useCallback(() => {
    const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
    if (s < 5) return "now";
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m`;
    return `${Math.floor(m / 60)}h`;
  }, [iso]);
  const [label, setLabel] = React.useState(fmt);
  React.useEffect(() => {
    const id = setInterval(() => setLabel(fmt()), 4_000);
    return () => clearInterval(id);
  }, [fmt]);
  return label;
}

// ── Stream Card ──────────────────────────────────────────────────────────

const DRAG_THRESHOLD = 90;

interface CardProps {
  notification: Notification;
  index: number;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
  onMarkRead: (id: string) => void;
}

function StreamCard({
  notification: n,
  index,
  onDismiss,
  onPause,
  onResume,
  onMarkRead,
}: CardProps) {
  const [hovered, setHovered] = React.useState(false);
  const pal = PAL[n.severity];
  const ts = useRelativeTime(n.timestamp);
  const themeVars = useNotificationThemeVars();

  const enter = () => {
    setHovered(true);
    onPause(n.id);
  };
  const leave = () => {
    setHovered(false);
    onResume(n.id);
  };
  const act = () => {
    n.action?.onClick?.();
    onMarkRead(n.id);
    onDismiss(n.id);
  };

  const onDragEnd = (_: unknown, info: PanInfo) => {
    if (
      Math.abs(info.offset.x) > DRAG_THRESHOLD ||
      Math.abs(info.velocity.x) > 400
    )
      onDismiss(n.id);
  };

  const depth = Math.min(index, 3);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 40, scale: 0.92 }}
      animate={{
        opacity: Math.max(0.15, 1 - depth * 0.25),
        y: depth * -3,
        scale: 1 - depth * 0.02,
      }}
      exit={{
        opacity: 0,
        x: 120,
        scale: 0.92,
        transition: { duration: 0.18, ease: [0.4, 0, 1, 1] },
      }}
      transition={SPRING_IN}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.25}
      onDragEnd={onDragEnd}
      onMouseEnter={enter}
      onMouseLeave={leave}
      style={{ zIndex: 100 - index, width: 380 }}
      className="touch-none w-[380px] max-w-[380px]"
    >
      <div
        onClick={() => onDismiss(n.id)}
        style={{
          backgroundColor: themeVars.card,
          color: themeVars.cardForeground,
          borderColor: themeVars.border,
        }}
        className={cn(
          "relative w-[380px] min-w-[380px] max-w-[380px] rounded-xl overflow-hidden",
          "cursor-pointer",
          "bg-card text-card-foreground",
          "border border-border",
          "shadow-[0_4px_16px_rgba(0,0,0,0.12)]",
          hovered && "shadow-[0_8px_24px_rgba(0,0,0,0.18)]",
          "transition-shadow duration-200",
        )}
      >
        {/* Severity accent bar — left edge */}
        <div
          className={cn("absolute left-0 top-0 bottom-0 w-[3px]", pal.bar)}
        />

        <div className="flex items-start gap-2.5 pl-4 pr-3 py-3">
          {/* Severity icon */}
          <div
            className={cn(
              "shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5",
              pal.iconBg,
            )}
          >
            <SevIcon
              severity={n.severity}
              className={cn("w-3.5 h-3.5", pal.text)}
            />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0 overflow-hidden space-y-1">
            <p
              className="text-[13px] font-semibold leading-snug text-foreground truncate"
              style={{ color: themeVars.foreground }}
            >
              {n.title}
            </p>
            {n.description && (
              <p
                className="text-[11px] leading-relaxed text-muted-foreground truncate"
                style={{ color: themeVars.mutedForeground }}
              >
                {n.description}
              </p>
            )}
            {/* Meta: group + timestamp */}
            <div className="flex items-center gap-2 pt-0.5">
              {n.group && (
                <span
                  className="px-1.5 py-px rounded text-[9px] font-bold uppercase tracking-wider bg-muted text-muted-foreground"
                  style={{
                    backgroundColor: themeVars.muted,
                    color: themeVars.mutedForeground,
                  }}
                >
                  {n.group}
                </span>
              )}
              <span
                className="text-[10px] tabular-nums text-muted-foreground"
                style={{ color: themeVars.mutedForeground }}
              >
                {ts}
              </span>
            </div>
            {/* Action — organic reveal */}
            <motion.div
              initial={false}
              animate={{
                height: hovered && n.action ? "auto" : 0,
                opacity: hovered && n.action ? 1 : 0,
              }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  act();
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 mt-1.5 rounded-lg text-[11px] font-bold bg-foreground text-background hover:opacity-90 active:scale-[0.97] transition-all duration-150"
              >
                {n.action?.label}
              </button>
            </motion.div>
          </div>

          {/* Progress arc + dismiss */}
          <div className="shrink-0 flex items-center gap-1.5 mt-0.5">
            <ProgressArc
              durationMs={n.durationMs}
              paused={hovered}
              severity={n.severity}
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDismiss(n.id);
              }}
              className={cn(
                "w-7 h-7 flex items-center justify-center rounded-lg",
                "text-muted-foreground",
                "hover:text-foreground",
                "hover:bg-muted",
                "active:scale-90 active:bg-muted/80",
                "transition-all duration-100",
              )}
              aria-label="Dismiss"
            >
              <XSvg className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// ── NotificationStream (portal overlay) ──────────────────────────────────

export interface NotificationStreamProps {
  /** Max visible cards (default: 5) */
  maxVisible?: number;
  className?: string;
}

export function NotificationStream({
  maxVisible = 5,
  className,
}: NotificationStreamProps) {
  const { notifications, dismiss, pause, resume, markRead } =
    useNotifications();
  const { resolvedTheme } = useTheme();
  const themeVars = useNotificationThemeVars();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Only show notifications that haven't been dismissed from the stream
  const active = React.useMemo(
    () => notifications.filter((n) => !n.dismissed),
    [notifications],
  );

  // Escape key dismisses topmost
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape" && active.length > 0) dismiss(active[0]!.id);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, dismiss]);

  if (!mounted || active.length === 0) return null;

  const visible = active.slice(0, maxVisible);

  return createPortal(
    <div
      className={cn(
        "fixed bottom-6 right-6 z-[9999] flex flex-col-reverse items-end gap-3 pointer-events-none",
        resolvedTheme === "dark" ? "dark" : "light",
        className,
      )}
      data-theme={resolvedTheme}
      role="log"
      aria-live="polite"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {visible.map((notif, i) => (
          <div key={notif.id} className="pointer-events-auto">
            <StreamCard
              notification={notif}
              index={i}
              onDismiss={dismiss}
              onPause={pause}
              onResume={resume}
              onMarkRead={markRead}
            />
          </div>
        ))}
      </AnimatePresence>
      {active.length > maxVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            backgroundColor: themeVars.card,
            borderColor: themeVars.border,
            color: themeVars.mutedForeground,
          }}
          className="pointer-events-auto px-3 py-1.5 rounded-full backdrop-blur-xl bg-card/90 border border-border shadow-sm"
        >
          <p
            className="text-[10px] font-bold tabular-nums text-muted-foreground"
            style={{ color: themeVars.mutedForeground }}
          >
            +{active.length - maxVisible} more
          </p>
        </motion.div>
      )}
    </div>,
    document.body,
  );
}
