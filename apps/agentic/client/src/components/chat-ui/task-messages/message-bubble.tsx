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
import { toast } from "sonner";
import type { TaskMessage } from "../types";

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

const ANIM_DURATION = 0.18;
const ANIM_EASE: [number, number, number, number] = [0.16, 1, 0.3, 1];

export const MessageBubble = memo(function MessageBubble({
  message,
  isUser,
  children,
  showActions = true,
  showHeader = true,
  variant = "default",
  onRegenerate,
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
  const showMeta = !isMinimal && showHeader;
  const eyebrow = isUser ? "You" : "Agent";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ANIM_DURATION, ease: ANIM_EASE }}
      className="relative w-full"
    >
      <div
        className={cn(
          "agentic-message-frame flex flex-col gap-2 py-4 border-b border-border/40 last:border-b-0",
          isUser && "items-end border-b-0 py-3",
          isMinimal && "agentic-message-frame-minimal"
        )}
        data-author={isUser ? "user" : "agent"}
      >
        {showMeta && (
          <div
            className={cn(
              "agentic-message-meta flex items-baseline gap-2",
              isUser && "justify-end"
            )}
          >
            <span
              className={cn(
                "text-[0.6875rem] font-semibold uppercase tracking-[0.14em]",
                isUser ? "text-muted-foreground" : "text-primary"
              )}
            >
              {eyebrow}
            </span>
            {timestamp && (
              <span className="text-[0.6875rem] tabular-nums text-muted-foreground/60">
                {timestamp}
              </span>
            )}
          </div>
        )}

        <div
          className={cn(
            "agentic-message-bubble min-w-0",
            isUser
              ? "agentic-message-bubble-user"
              : "agentic-message-bubble-agent",
            isMinimal && "agentic-message-bubble-minimal"
          )}
          data-variant={isMinimal ? "minimal" : "default"}
        >
          <div className="agentic-message-body text-[0.9375rem] leading-[1.65] tracking-normal text-foreground">
            {children}
          </div>
        </div>

        {showActions && (
          <div
            className={cn(
              "agentic-message-actions flex w-full items-center pt-1",
              isUser && "justify-end"
            )}
          >
            <div
              className="flex items-center gap-0.5"
              role="toolbar"
              aria-label="Message actions"
            >
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

            {actionSlot && <div className="ml-auto shrink-0">{actionSlot}</div>}
          </div>
        )}
      </div>
    </motion.div>
  );
});

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
        "agentic-message-action-button inline-flex items-center justify-center w-7 h-7 rounded transition-colors duration-150 ease-out",
        "focus:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        active
          ? "text-primary bg-primary/10"
          : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/40"
      )}
      title={label}
      aria-label={label}
      aria-pressed={active}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
});
