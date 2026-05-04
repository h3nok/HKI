/**
 * MessageBubble — Chat Message Card
 *
 * Layout:
 * ┌─────────────────────────────────────┐
 * │  content                            │
 * └─────────────────────────────────────┘
 *  timestamp · copy · 👍 · 👎 · regen          🛡️ trust ▾
 *  └── left actions ──┘               └── right slot ──┘
 *
 * - No avatars — identity conveyed by alignment
 * - User: right-aligned, neutral warm surface
 * - Agent: left-aligned, minimal variant = bare text
 * - Actions: persistent below the card, never hidden
 * - Action bar stretches full width; left = buttons, right = actionSlot
 */

import { useState, useCallback, useMemo, memo } from "react";
import { motion } from "framer-motion";
import {
  Copy,
  RefreshCw,
  RotateCcw,
  Check,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import { cn } from "@hki/ui";
import { BRAND, RADIUS } from "../../../design-system/tokens";
import { toast } from "sonner";
import type { TaskMessage } from "../types";

// ============================================================================
// TYPES
// ============================================================================

interface MessageBubbleProps {
  message: TaskMessage;
  isUser: boolean;
  children: React.ReactNode;
  showActions?: boolean;
  showHeader?: boolean;
  variant?: "default" | "minimal";
  onRegenerate?: () => void;
  onPin?: () => void;
  onReply?: () => void;
  onFeedback?: (messageId: string, sentiment: "up" | "down") => void;
  /** Extra content rendered at the right edge of the action bar (e.g. TrustIndicator) */
  actionSlot?: React.ReactNode;
}

// ============================================================================
// DESIGN TOKENS
// ============================================================================

const T = {
  px: 18,
  py: 14,
  anim: {
    duration: 0.25,
    ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
  },
} as const;

// ============================================================================
// COMPONENT
// ============================================================================

export const MessageBubble = memo(function MessageBubble({
  message,
  isUser,
  children,
  showActions = true,
  variant = "default",
  onRegenerate,
  onPin,
  onFeedback,
  actionSlot,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<"up" | "down" | null>(null);

  const handleCopy = useCallback(async () => {
    const textContent =
      message.content.type === "text"
        ? message.content.content
        : JSON.stringify(message.content);

    try {
      await navigator.clipboard.writeText(textContent);
      setCopied(true);
      toast.success("Copied to clipboard", { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      console.warn("[Clipboard] writeText failed — falling back to selection");
    }
  }, [message.content]);

  const handleFeedback = useCallback(
    (sentiment: "up" | "down") => {
      const next = feedback === sentiment ? null : sentiment;
      setFeedback(next);
      if (next) {
        onFeedback?.(message.id, next);
        toast.success(
          next === "up"
            ? "Thanks for the feedback!"
            : "We'll work on improving this.",
          { duration: 2000 }
        );
      }
    },
    [feedback, message.id, onFeedback]
  );

  const timestamp = useMemo(() => {
    if (!message.created_at) return "";
    try {
      return new Date(message.created_at).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }, [message.created_at]);

  const isMinimal = !isUser && variant === "minimal";
  const showFeedbackActions = !isUser && Boolean(onFeedback);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: T.anim.duration, ease: T.anim.ease }}
      className={cn(
        "relative flex w-full",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      <div
        className={cn(
          "relative flex flex-col min-w-0",
          isUser ? "items-end max-w-[75%]" : "items-start",
          isMinimal ? "max-w-full w-full" : !isUser ? "max-w-[85%]" : ""
        )}
      >
        {/* ── Card ─────────────────────────────────────────────── */}
        <div
          className="relative w-full"
          style={{
            borderRadius: isMinimal ? 0 : RADIUS.xl,
            ...(isMinimal
              ? {
                  background: "transparent",
                  padding: `${T.py - 4}px 0`,
                }
              : isUser
                ? {
                    background: `color-mix(in srgb, ${BRAND.blue[500]} 8%, var(--card))`,
                    padding: `${T.py - 3}px ${T.px}px`,
                  }
                : {
                    background: "var(--card)",
                    borderTop: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                    borderRight: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                    borderBottom: "1px solid color-mix(in srgb, var(--border) 60%, transparent)",
                    borderLeft: "2px solid color-mix(in srgb, var(--primary) 40%, var(--border))",
                    boxShadow:
                      "0 1px 3px rgba(0,0,0,0.04), 0 1px 0 rgba(255,255,255,0.03) inset",
                    padding: `${T.py + 2}px ${T.px + 2}px`,
                  }),
          }}
        >
          {/* Content */}
          <div
            className="relative z-10"
            style={{ fontSize: 15, lineHeight: 1.65, letterSpacing: "-0.01em" }}
          >
            {children}
          </div>
        </div>

        {/* ── Persistent action bar — full-width under the card ── */}
        {showActions && (
          <div
            className={cn(
              "flex w-full items-center mt-1 mb-2",
              isUser ? "flex-row-reverse pr-0.5" : "pl-0.5"
            )}
          >
            {/* Left zone: timestamp + action buttons */}
            <div
              className="flex items-center gap-0.5"
              role="toolbar"
              aria-label="Message actions"
            >
              {/* Timestamp */}
              {timestamp && (
                <span
                  className="select-none font-medium tabular-nums px-1"
                  style={{
                    fontSize: 10,
                    color: "var(--muted-foreground)",
                    opacity: 0.5,
                  }}
                  aria-label={`Sent at ${timestamp}`}
                >
                  {timestamp}
                </span>
              )}

              {/* Copy */}
              <ActionBtn
                icon={copied ? Check : Copy}
                label={copied ? "Copied" : "Copy message"}
                onClick={handleCopy}
                active={copied}
              />

              {isUser ? (
                onRegenerate ? (
                  <ActionBtn
                    icon={RotateCcw}
                    label="Rerun"
                    onClick={onRegenerate}
                  />
                ) : null
              ) : (
                <>
                  {showFeedbackActions && (
                    <>
                      <ActionBtn
                        icon={ThumbsUp}
                        label="Helpful"
                        onClick={() => handleFeedback("up")}
                        active={feedback === "up"}
                      />
                      <ActionBtn
                        icon={ThumbsDown}
                        label="Not helpful"
                        onClick={() => handleFeedback("down")}
                        active={feedback === "down"}
                      />
                    </>
                  )}
                  {onRegenerate && (
                    <ActionBtn
                      icon={RefreshCw}
                      label="Regenerate"
                      onClick={onRegenerate}
                    />
                  )}
                </>
              )}
            </div>

            {/* Right zone: injected slot (e.g. TrustIndicator) */}
            {actionSlot && <div className="ml-auto shrink-0">{actionSlot}</div>}
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

interface ActionBtnProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick?: () => void;
  active?: boolean;
}

const ActionBtn = memo(function ActionBtn({
  icon: Icon,
  label,
  onClick,
  active,
}: ActionBtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center rounded-md",
        "transition-all duration-150",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/50",
        active
          ? "text-primary bg-primary/10"
          : "text-muted-foreground/40 hover:text-foreground hover:bg-muted/60 active:scale-95"
      )}
      style={{ width: 26, height: 26 }}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
});
