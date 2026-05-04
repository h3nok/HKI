/**
 * GuidedTooltip — Progressive disclosure tooltip for first-time users
 *
 * Shows contextual tips on elements users haven't interacted with yet.
 * Dismisses on click or after timeout. State persisted per-user in localStorage.
 *
 * Usage:
 *   <GuidedTooltip id="sidebar-ingest" content="Upload documents here">
 *     <SidebarButton … />
 *   </GuidedTooltip>
 */

import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Lightbulb } from "lucide-react";
import { cn } from "@hki/ui";
import { ACCENT } from "../theme";

const STORAGE_KEY = "kb-guided-tips-dismissed";

function getDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {
    /* silent */
  }
}

export type TooltipPosition = "top" | "bottom" | "left" | "right";

interface GuidedTooltipProps {
  /** Unique ID — persisted to localStorage so tip only shows once */
  id: string;
  /** Tooltip content */
  content: string;
  /** Optional title (bolder) */
  title?: string;
  /** Arrow position relative to children */
  position?: TooltipPosition;
  /** Delay before showing (ms) */
  delay?: number;
  /** Auto-dismiss after N ms (0 = no auto-dismiss) */
  autoDismiss?: number;
  children: ReactNode;
}

const positionClasses: Record<TooltipPosition, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

const arrowClasses: Record<TooltipPosition, string> = {
  top: "top-full left-1/2 -translate-x-1/2 border-t-primary/90 border-l-transparent border-r-transparent border-b-transparent",
  bottom:
    "bottom-full left-1/2 -translate-x-1/2 border-b-primary/90 border-l-transparent border-r-transparent border-t-transparent",
  left: "left-full top-1/2 -translate-y-1/2 border-l-primary/90 border-t-transparent border-b-transparent border-r-transparent",
  right:
    "right-full top-1/2 -translate-y-1/2 border-r-primary/90 border-t-transparent border-b-transparent border-l-transparent",
};

export default function GuidedTooltip({
  id,
  content,
  title,
  position = "bottom",
  delay = 800,
  autoDismiss = 8000,
  children,
}: GuidedTooltipProps) {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissedState] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const alreadyDismissed = getDismissed().has(id);
    if (alreadyDismissed) {
      setDismissedState(true);
      return;
    }

    timerRef.current = setTimeout(() => setVisible(true), delay);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, delay]);

  // Auto-dismiss
  useEffect(() => {
    if (!visible || autoDismiss === 0) return;
    const t = setTimeout(() => dismiss(), autoDismiss);
    return () => clearTimeout(t);
  }, [visible, autoDismiss]);

  function dismiss() {
    setVisible(false);
    setDismissedState(true);
    const current = getDismissed();
    current.add(id);
    setDismissed(current);
  }

  if (dismissed) return <>{children}</>;

  return (
    <div className="relative inline-flex">
      {/* Wrapped children */}
      <div onClick={dismiss}>{children}</div>

      {/* Tooltip */}
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={{
              opacity: 0,
              scale: 0.92,
              y: position === "bottom" ? -4 : position === "top" ? 4 : 0,
              x: position === "right" ? -4 : position === "left" ? 4 : 0,
            }}
            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={cn("absolute z-[100] w-56", positionClasses[position])}
          >
            <div className="relative bg-primary/95 backdrop-blur-sm text-white rounded-xl p-3 shadow-xl shadow-primary/20 border border-primary/80">
              {/* Arrow */}
              <div
                className={cn(
                  "absolute w-0 h-0 border-[5px]",
                  arrowClasses[position]
                )}
              />

              {/* Close button */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  dismiss();
                }}
                className="absolute top-1.5 right-1.5 p-0.5 rounded-md hover:bg-white/15 transition-colors"
              >
                <X className="w-3 h-3" />
              </button>

              <div className="flex items-start gap-2">
                <Lightbulb className="w-3.5 h-3.5 text-amber-300 shrink-0 mt-0.5" />
                <div className="min-w-0">
                  {title && (
                    <p className="text-xs font-bold leading-tight mb-0.5">
                      {title}
                    </p>
                  )}
                  <p className="text-[11px] leading-relaxed opacity-90">
                    {content}
                  </p>
                </div>
              </div>

              {/* Pulse ring on first appearance */}
              <motion.div
                className="absolute -inset-1 rounded-xl border-2 border-primary/40"
                initial={{ opacity: 0.8 }}
                animate={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 1.5, repeat: 2, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
